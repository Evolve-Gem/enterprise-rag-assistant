# Server Inventory Audit — `81.70.51.32`（只读）

> **审计性质**：只读扫描。**未删除、未重启、未修改任何配置**。
> 使用的全部命令：`docker ps -a` / `images` / `volume ls` / `network ls` / `system df (-v)` / `info` /
> `du` / `df` / `ls` / `ss -lntp` / `nginx -t` / `grep` / `systemctl list-units`。
> 未执行任何 `prune` / `rm` / `restart` / `down` / `stop`。
>
> - 审计时间：2026-09-25
> - 主机：腾讯云轻量 `81.70.51.32`（`VM-0-16-ubuntu`，Ubuntu 22.04.5，2 vCPU / 1963 MB RAM / swap 2 GB）
> - **目标**：识别 V4 发布后**可安全清理**的旧资源

---

## 0. 一句话结论

**底盘很干净，但有两块"沉在水下"的占用值得清理。**

- 与**本项目**相关的可回收空间其实不多（悬空镜像 43 MB + 废弃容器 4 KB）。
- 真正的大头在别处：**Docker 构建缓存 ~6.2 GB**（在 `/var/lib/containerd`）、
  **`/home/ubuntu/.vscode-server` 4.5 GB**、**`/var/log/journal` 745 MB**、
  **`/var/backups` 里的 2.7 GB 外部项目备份**。
- ⚠️ **两条必须保留**：`python:3.12-slim` / `node:22-alpine`（构建基础镜像，此机重拉极慢）、
  以及 `rag-copilot-web:3.0.0`（V4 的回滚镜像，V4 验证稳定前不能删）。

---

## 1. 磁盘总览

```
/dev/vda2   50G   29G used   19G avail   61%   /
```

| 路径 | 占用 | 说明 |
| --- | --- | --- |
| `/var` | **17 G** | 其中 `/var/lib` 12 G、`/var/backups` 2.7 G、`/var/www` 2.0 G、`/var/log` 793 M |
| `/home` | **4.8 G** | 其中 `.vscode-server` **4.5 G**、`apps` 286 M |
| `/usr` | 4.4 G | 系统 |
| `/boot` | 259 M | 可能含旧内核 |
| `/tmp` | 21 M | |
| **`/opt`** | **18 M** | 几乎不占空间（见 §4） |
| `/etc` | 6.3 M | |

**`/var/lib` 明细**

| 路径 | 占用 | 备注 |
| --- | --- | --- |
| **`/var/lib/containerd`** | **10 G** | ← **Docker 的镜像/层与构建缓存实际落盘处**（含 containerd 快照） |
| `/var/lib/snapd` | 1001 M | snap 包（含 5 个 disabled 旧修订） |
| `/var/lib/apt` | 314 M | |
| `/var/lib/kdump` | 99 M | |
| `/var/lib/docker` | **38 M** | 仅 buildkit 元数据 + 容器元数据，**不含镜像层** |

> **口径提醒**：`docker system df` 报的 "Images 10.25 GB / Build Cache 8.533 GB" 是**表观值**，
> 会把多镜像共享的层重复计入（实际唯一占用约 2.9 GB），而且这些数据落在 `/var/lib/containerd`，
> 不在 `/var/lib/docker`。按 `du` 实测为准。

---

## 2. Docker 容器

| 容器 | 镜像 | 状态 | 端口 | 创建 | 判断 |
| --- | --- | --- | --- | --- | --- |
| `enterprise-rag-copilot-web-1` | `rag-copilot-web:3.0.0` | **Up 6 days (healthy)** | `0.0.0.0:3001→3001` | 2026-09-19 | ✅ **本项目 V3 在线服务，保留** |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0` | **Up 6 days (healthy)** | `127.0.0.1:18000→8000` | 2026-09-19 | ✅ **保留** |
| `enterprise-rag-demo` | `enterprise-rag-demo:20260822` | Up 4 weeks (healthy) | `0.0.0.0:8502→8501` | 2026-08-22 | ⚠️ **legacy V2（`streamlit run app.py`）—— 需你确认后再动** |
| `tender_euclid` | `hello-world` | **Exited (0) 7 weeks ago** | — | 2026-08-04 | 🗑 **纯垃圾，可清** |

---

## 3. Docker 镜像

| 镜像 | ID | 表观大小 | 唯一占用 | 容器 | 判断 |
| --- | --- | --- | --- | --- | --- |
| `rag-copilot-web:3.0.0` | `21cd214378ea` | 1.26 GB | 1.261 GB | 1 | 🔒 **保留** —— V4 的回滚镜像 |
| `rag-copilot-backend:3.0.0` | `af895e658e6d` | 460 MB | 460.2 MB | 1 | 🔒 在用 |
| `enterprise-rag-demo:20260822` | `138dde237055` | 803 MB | 669 MB | 1 | ⚠️ 与 legacy 容器同进退 |
| `python:3.12-slim` | `78387bc3881b` | 190 MB | 190.4 MB | 0 | 🔒 **保留** —— backend 构建基础镜像 |
| `node:22-alpine` | `c610fcdfb1d5` | 232 MB | 232.3 MB | 0 | 🔒 **保留** —— web 构建基础镜像 |
| `<none>:<none>`（悬空） | `d0d04a129052` | 177 MB | **43.23 MB** | 0 | 🗑 **可清**（4 周前构建残层） |
| `hello-world:latest` | `c3cbe1cc1aa5` | 25.9 kB | 25.87 kB | 1 | 🗑 可清（与 `tender_euclid` 成对） |

> **`python:3.12-slim` 与 `node:22-alpine` 绝不能当"未使用"清掉。** 它们的 `containers=0`，
> `docker image prune` 会**优先挑中它们**；而本机到 pypi.org 实测只有 18 KB/s、到 npm 也很慢
> （见 `docker/Dockerfile.backend` 注释里的实测数据），重拉会显著拖长下一次部署。

## 4. Docker volume / network

| 类型 | 名称 | 占用 | 判断 |
| --- | --- | --- | --- |
| volume | `enterprise-rag-copilot_backend-data` | 490.3 kB（links=1） | 🔒 **保留** —— 索引缓存 + 运行台账 + 评测集 |
| network | `enterprise-rag-copilot_default` | — | 🔒 在用（web ↔ backend） |
| network | `bridge` / `host` / `none` | — | Docker 内置，勿动 |

**可回收**：volume 0 B、container 4.096 kB（仅 `tender_euclid`）。

## 5. `/opt` 占用

```
16K   /opt/containerd
18M   /opt/enterprise-rag-copilot
```

`/opt/enterprise-rag-copilot/` 下**只有 `repo/`**（18 M，其中 `.git` 7.9 M）。
`.env` 不在上级目录，而在 **`repo/.env`**（compose 的工作目录即 `repo/`）：

| 文件 | 权限 | 大小 | 修改时间 | 判断 |
| --- | --- | --- | --- | --- |
| `repo/.env` | `-rw-------`（600） | 5556 B | 2026-09-19 | 🔒 保留 |
| `repo/.env.bak.20260919-120955` | `-rw-------`（600） | 5084 B | 2026-09-17 | ✅ 权限正确；可留作回滚 |
| `repo/.env.example` / `.env.production.example` | 664 | — | — | 模板，保留 |

> 与本项目**无关**的 `/opt` 内容：无。`/opt` 总共 18 M，**不是空间问题所在**。

---

## 6. 端口暴露（附带发现：超出"资源清理"范围，但直接影响 legacy 容器去留）

从公网实测（原始 IP，无 TLS）：

| 端口 | 归属进程 | 公网可reachable | 判断 |
| --- | --- | --- | --- |
| 80 | nginx | 401 | ✅ 预期 |
| 443 | nginx | 400 | ✅ 预期（TLS 分流） |
| 18080 | `uvicorn`（`moodcare.service`） | **不可达** | ✅ 仅回环，nginx 前置 |
| 18000 | `docker-proxy`（backend） | **不可达** | ✅ 仅回环 |
| 3001 | `docker-proxy`（web） | **不可达** | ✅ 仅回环（经 nginx 443 对外） |
| **8000** | `gunicorn`（`eat-what.service`） | **502（可达）** | ⚠️ 《吃是什么呢》Flask 被**裸端口直接暴露**，绕过了 nginx/TLS |
| **8502** | `docker-proxy`（`enterprise-rag-demo`） | **200（可达）** | ⚠️ legacy V2 Streamlit 被**裸端口直接暴露**，无 TLS |

nginx 已启用站点（6 个）与上游对照：

| 站点 | 上游 / 根 |
| --- | --- |
| `rag.changziqi.com` | `proxy_pass http://127.0.0.1:3001` ← 本项目 V3 |
| `eat.changziqi.com` | `proxy_pass http://127.0.0.1:8000` |
| `mood.changziqi.com` | `proxy_pass http://127.0.0.1:18080` |
| `changziqi-space` | `root /var/www/changziqi-space` |
| `love-archive-preview` | `root /var/www/love-archive-preview` |
| `default` | `root /var/www/html` + `server_name 81.70.51.32 liuyutong.changziqi.com` |

**没有任何 nginx 站点引用 8501 / 8502** —— `enterprise-rag-demo` 只能通过 `http://81.70.51.32:8502` 访问。

---

## 7. V4 发布后可安全清理的旧资源（分级）

### T1 — 无风险，可直接清（收益小）

| 目标 | 释放 | 依据 |
| --- | --- | --- |
| 容器 `tender_euclid`（hello-world，7 周前 Exited） | 4 KB | 一次性测试容器，无 volume、无端口 |
| 镜像 `hello-world:latest` | 26 KB | 仅被上面的容器使用 |
| 悬空镜像 `d0d04a129052` | **43 MB**（唯一占用） | 4 周前构建残层，无 tag、无容器引用 |

### T2 — 低风险，收益大（不改任何配置，只清可再生成物）

| 目标 | 预计释放 | 说明与代价 |
| --- | --- | --- |
| **Docker 构建缓存**（`docker builder prune`） | **约 6.2 GB**（`system df` 报可回收 6.231 GB） | 只影响下一次构建的速度；基础镜像层不受影响。**建议保留最近一次**（用 `--filter until=168h` 或直接清空后重建一次） |
| **journal 日志**（`journalctl --vacuum-size=200M`） | **约 545 MB**（现 745 MB） | 仅保留近期日志 |
| **snap 旧修订**（5 个 disabled：core20/core22/core24） | 数百 MB（`/var/lib/snapd` 共 1001 MB） | `snap set system refresh.retain=2` + 删除 disabled 修订；不影响 certbot |
| **`/home/ubuntu/.vscode-server`** | **4.5 GB**（全机最大单项） | 会在下次 VS Code 远程连接时**自动重新下载**。⚠️ 若你正在用 VS Code Remote 连着这台机器，删除会断开当前会话 |

### T3 — 需你确认后再动（涉及其他项目 / 可能仍在服务）

| 目标 | 释放 | 为什么要你确认 |
| --- | --- | --- |
| `enterprise-rag-demo` 容器 + `enterprise-rag-demo:20260822` 镜像 | 803 MB（镜像 669 MB 唯一） + 停服 | 它是本项目 **legacy V2（Streamlit）**，**当前仍在公网 :8502 上返回 200**。若这是有意保留的"旧版演示"，就不能清；若是忘了下线的历史容器，则清了还能顺手关掉一个裸端口 |
| `/var/backups/love-archive-final-predeploy-20260814-230142.tar` + `love-archive-preview-pre-performance-20260814.tar` | **2.7 GB** | 属于 **love-archive 项目**（非本项目）2026-08-14 的部署前备份。需确认该项目已稳定、不再需要这两个回滚点 |
| `/home/ubuntu/apps/enterprise-rag-assistant`（2026-08-22） | 约 100–286 MB | 疑似 legacy V2 的旧部署目录（时间与 demo 镜像一致）。live 副本已在 `/opt/enterprise-rag-copilot/repo` |
| `/var/www/changziqi-space.bak-*`（3 个） | 约 1.6 MB | 个人站点的历史备份，体积小，随你 |

### 🔒 必须保留（清单，防止误清）

| 对象 | 原因 |
| --- | --- |
| `rag-copilot-web:3.0.0` | **V4 部署后的回滚镜像** —— V4 稳定前绝不可删 |
| `rag-copilot-backend:3.0.0` | 在线服务 |
| `python:3.12-slim`、`node:22-alpine` | **构建基础镜像**；此机重拉极慢，`prune` 会优先误伤 |
| volume `enterprise-rag-copilot_backend-data` | 索引缓存 / 运行台账 / 评测集 |
| network `enterprise-rag-copilot_default` | web ↔ backend |
| `/opt/enterprise-rag-copilot/repo/.env` + `.env.bak.*` | 生产配置（600 权限，正确） |
| `/home/ubuntu/apps/eat-what`、`moodcare` | `eat-what.service` / `moodcare.service` 的 live 代码 |
| `/var/www/love-archive-preview`（2.0 GB） | 在用站点根目录 |

---

## 8. 清理时序（关键建议）

**不要把"清理"和"V4 发布"放进同一个窗口。** 建议：

| 阶段 | 动作 | 可回收 |
| --- | --- | --- |
| **发布前** | 只做 T1 + T2（`builder prune` / journal / snap / vscode-server） | ~11 GB |
| **发布窗口** | 不动任何镜像与容器；按 Freeze 报告的强制清单部署 V4 | — |
| **V4 稳定 3–7 天后** | 才评估删除 `rag-copilot-web:3.0.0` | 1.26 GB |
| **确认 legacy 不再需要后** | 下线 `enterprise-rag-demo` + 删镜像 + 关 :8502 | 803 MB |
| **确认 love-archive 备份不再需要后** | 删 `/var/backups` 两个 tar | 2.7 GB |

理由：V4 一旦出问题，`rag-copilot-web:3.0.0` 是唯一能一条命令回滚的镜像；而 legacy 容器是 V2 的唯一运行副本。
在发布窗口同时清掉它们，等于把两条退路一起拆掉。

---

## 9. 与本次审计无关但值得记录的两条

1. **`:8000` 与 `:8502` 对公网裸端口开放**（其余端口均已收敛到回环）。安全边界应是腾讯云安全组；
   建议把入站规则收敛到 **仅 80 / 443**。本次为只读审计，**未改任何安全组或防火墙**。
2. `/var/lib/docker` 只有 38 MB，而 `/var/lib/containerd` 有 10 GB ——
   这台机器用的是 **containerd 快照器**（`Storage Driver: overlayfs`），
   所以以后判断 Docker 占用要 **`du /var/lib/containerd`**，看 `/var/lib/docker` 会得出错误的结论。

---

## 10. 边界声明

- 本轮**未删除、未重启、未修改任何配置**；未执行任何 `docker prune/rm/stop/restart/down`。
- 未修改 nginx、systemd、安全组、`.env` 或任何应用文件。
- 报告不含任何密钥值；`.env` 只记录路径、权限与大小。
- 所有数字来自本次实测（`du` / `df` / `docker` / `ss`），`docker system df` 的表观值已标注为口径提醒。

---

*本报告只记录实测结果。需要我确认的项都已标在 T3，未被擅自处理。*
