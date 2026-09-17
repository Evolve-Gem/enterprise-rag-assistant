# 一句话总结

> **YAML 是一种通过“键值对、列表和缩进”表达结构化数据的文本配置格式；在 Skill 中，它通常位于 `SKILL.md` 顶部，用来声明 Skill 的名称、描述等元数据，而 Markdown 正文负责描述具体执行方法。**


它的全称是：

> **YAML Ain’t Markup Language**

意思是“YAML 不是标记语言”。你可以先把它理解成：

> **一种比 JSON 更适合人类阅读和修改的配置文件格式。**

---

# 一、最基本的 YAML 长什么样？

```yaml
name: competitor-analysis
description: 分析竞品销量、价格和渠道表现
version: 1.0
```

每一行基本都是：

```text
键: 值
```

这和 Python 字典很像：

```python
skill = {
    "name": "competitor-analysis",
    "description": "分析竞品销量、价格和渠道表现",
    "version": 1.0
}
```

所以你可以先建立这个对应关系：

```text
YAML              Python

name: test    →   {"name": "test"}
```

---

# 二、YAML 在 Skill 里面是什么？

你在 `SKILL.md` 顶部看到的：

```markdown
---
name: competitor-analysis
description: 分析竞品销量、价格和渠道表现
---

# Competitor Analysis
```

这里分成两部分。

## 上面的 YAML

```yaml
name: competitor-analysis
description: 分析竞品销量、价格和渠道表现
```

负责保存 Skill 的**元数据**，例如：

- Skill 叫什么；
    
- Skill 是干什么的；
    
- 什么情况下应该使用；
    
- 版本是多少；
    
- 作者是谁。
    

## 下面的 Markdown

```markdown
# Competitor Analysis
```

负责写详细说明，例如：

- 执行步骤；
    
- 业务规则；
    
- 注意事项；
    
- 输出要求；
    
- 如何调用脚本。
    

因此，`SKILL.md` 可以理解成：

```text
YAML 元数据
+
Markdown 说明正文
```

上下两个 `---` 表示：

> 这一块是 YAML Frontmatter，也就是文档头部的结构化信息。

---

# 三、YAML 怎样表达不同数据？

## 1. 字符串

```yaml
name: competitor-analysis
description: "这是一个竞品分析 Skill"
```

多数普通字符串可以不加引号。

遇到特殊符号、容易产生歧义的内容时，可以加引号：

```yaml
description: "分析范围：销量、价格、渠道"
```

---

## 2. 数字

```yaml
version: 1.0
top_k: 5
timeout: 30
```

---

## 3. 布尔值

```yaml
enabled: true
debug: false
```

注意是：

```yaml
true
false
```

通常不是 Python 的：

```python
True
False
```

---

## 4. 列表

第一种写法：

```yaml
skills:
  - competitor-analysis
  - price-analysis
  - channel-analysis
```

对应 Python：

```python
skills = [
    "competitor-analysis",
    "price-analysis",
    "channel-analysis"
]
```

也可以写成：

```yaml
skills: [competitor-analysis, price-analysis, channel-analysis]
```

但是多行形式通常更容易阅读。

---

## 5. 嵌套对象

```yaml
model:
  name: deepseek-chat
  temperature: 0.2
  max_tokens: 2000
```

对应 Python：

```python
model = {
    "name": "deepseek-chat",
    "temperature": 0.2,
    "max_tokens": 2000
}
```

---

## 6. 列表里面放对象

```yaml
tools:
  - name: search_database
    description: 查询数据库
    enabled: true

  - name: calculate_growth
    description: 计算增长率
    enabled: true
```

对应 Python：

```python
tools = [
    {
        "name": "search_database",
        "description": "查询数据库",
        "enabled": True
    },
    {
        "name": "calculate_growth",
        "description": "计算增长率",
        "enabled": True
    }
]
```

---

# 四、YAML 最重要的规则：靠缩进表示层级

Python 使用缩进表示代码块，YAML 也使用缩进表示数据层级。

例如：

```yaml
agent:
  name: competitor-agent
  model:
    provider: deepseek
    temperature: 0.2
```

结构是：

```text
agent
├── name
└── model
    ├── provider
    └── temperature
```

错误写法：

```yaml
agent:
name: competitor-agent
model:
provider: deepseek
```

因为没有缩进，程序就不知道谁属于谁。

---

# 五、YAML 的几个常见坑

## 1. 冒号后面必须留空格

正确：

```yaml
name: competitor-analysis
```

错误：

```yaml
name:competitor-analysis
```

---

## 2. 不要用 Tab 缩进

YAML 通常要求使用空格。

推荐每一级缩进两个空格：

```yaml
model:
  name: deepseek-chat
  parameters:
    temperature: 0.2
```

不要按 Tab 键混入制表符，否则可能出现很难发现的解析错误。

---

## 3. 同一级必须对齐

正确：

```yaml
model:
  name: deepseek-chat
  temperature: 0.2
```

错误：

```yaml
model:
  name: deepseek-chat
   temperature: 0.2
```

`temperature` 多了一个空格，层级就可能出错。

---

## 4. `-` 表示列表项

```yaml
references:
  - sales_definition.md
  - channel_rules.md
  - sku_mapping.csv
```

这里每个 `-` 都代表列表中的一个元素。

---

## 5. `#` 表示注释

```yaml
temperature: 0.2  # 控制模型输出的随机性
```

程序通常不会把注释当成实际数据。

但字符串本身包含 `#` 时，最好加引号：

```yaml
title: "Agent #1"
```

---

# 六、YAML、JSON 和 Python 字典的关系

这三者经常表达相同的数据，只是写法不同。

### YAML

```yaml
model:
  name: deepseek-chat
  temperature: 0.2
```

### JSON

```json
{
  "model": {
    "name": "deepseek-chat",
    "temperature": 0.2
  }
}
```

### Python 字典

```python
config = {
    "model": {
        "name": "deepseek-chat",
        "temperature": 0.2
    }
}
```

它们表达的是同一个结构。

区别是：

- **YAML**：适合人阅读和写配置；
    
- **JSON**：适合程序之间传输数据；
    
- **Python 字典**：是 Python 程序运行过程中的数据对象。
    

---

# 七、`.yaml` 文件和 `SKILL.md` 里的 YAML 是什么关系？

YAML 可以单独保存成文件：

```text
config.yaml
config.yml
```

例如：

```yaml
model: deepseek-chat
temperature: 0.2
```

也可以嵌入 Markdown 文档顶部：

```markdown
---
name: competitor-analysis
description: 竞品分析 Skill
---
```

所以你在 `SKILL.md` 里看到的不是完整的 `.yaml` 文件，而是：

> **嵌入 Markdown 顶部的 YAML 配置块。**

---


你可以先牢牢记住：

```text
冒号表示键和值
缩进表示层级
短横线表示列表
# 表示注释
--- 包住 YAML 文档头
```



# 你不觉得怪吗？

**我去，哪里有用否定句做定义的，而且YAML的解释里包含YAML，这个解释是不是有点荒诞？？？**


你吐槽得完全对。😂

我刚才把 **“YAML Ain’t Markup Language”当成了 YAML 的定义**，这确实不严谨。它不是定义，而是 YAML 官方采用的一个**递归缩写名称**。

所谓递归缩写，就是缩写展开后又包含缩写本身：

```text
YAML
= YAML Ain’t Markup Language
```

于是你继续问第一个 YAML 是什么，它又会展开成：

```text
YAML Ain’t Markup Language Ain’t Markup Language……
```

理论上可以无限套娃。它本来就是程序员式的文字游戏，不是用来严肃解释概念的。

更有意思的是，YAML 最初确实叫：

> **Yet Another Markup Language**  
> 又一种标记语言

后来开发者认为 YAML 的核心用途不是像 HTML、XML 那样给文档添加标记，而是保存、传输结构化数据，于是把全称改成了这个带玩笑性质的递归缩写，强调“它不是标记语言”。([YAML](https://yaml.org/about/?utm_source=chatgpt.com "About - YAML Ain't Markup Language"))

所以正确表达应该分开：

### YAML 的名字

> YAML Ain’t Markup Language。

这是官方名称，是一个递归缩写和程序员梗。

### YAML 的真正定义

> **YAML 是一种面向人类阅读的结构化数据序列化格式，常用于编写配置文件和交换数据。** ([YAML](https://yaml.org/spec/1.2.2/ext/glossary/?utm_source=chatgpt.com "YAML Ain’t Markup Language (YAML™) revision 1.2.2"))

通俗说就是：

> **用缩进、键值对和列表，把数据写成容易阅读的文本。**

例如：

```yaml
name: competitor-analysis
version: 1.0
enabled: true
```

它表达的其实就是类似 Python 字典的数据：

```python
{
    "name": "competitor-analysis",
    "version": 1.0,
    "enabled": True
}
```

所以你刚才觉得荒诞，不是你理解错了，而是这个名字**本来就故意荒诞**。我之前应该先说清楚“这是名称，不是定义”，而不是拿它解释 YAML 是什么。