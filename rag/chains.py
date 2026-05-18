import os


def _format_retrieved_context(retrieved_chunks: list[dict]) -> str:
    """Format retrieved chunks into a compact context block for the LLM."""
    context_parts: list[str] = []

    for index, chunk in enumerate(retrieved_chunks, start=1):
        source_title = chunk.get("source_title", "未知来源")
        chunk_id = chunk.get("chunk_id", f"chunk_{index}")
        content = chunk.get("content", "")

        context_parts.append(
            "\n".join(
                [
                    f"资料片段 {index}",
                    f"来源标题：{source_title}",
                    f"chunk_id：{chunk_id}",
                    "内容：",
                    str(content),
                ]
            )
        )

    return "\n\n---\n\n".join(context_parts)


def generate_answer(question: str, retrieved_chunks: list[dict]) -> str:
    """Generate a knowledge-base answer with DeepSeek based on retrieved chunks."""
    question = question.strip()
    if not question:
        return "请输入问题。"

    if not retrieved_chunks:
        return "暂未从知识库中检索到相关资料，无法生成可靠回答。"

    try:
        from dotenv import load_dotenv
        from openai import OpenAI
    except ImportError as exc:
        return f"缺少必要依赖：{exc.name}，请确认 requirements.txt 中的依赖已安装。"

    load_dotenv()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return (
            "未检测到 DEEPSEEK_API_KEY。请在项目根目录创建 .env 文件，"
            "并写入 DEEPSEEK_API_KEY=你的 API Key 后重试。"
        )

    context = _format_retrieved_context(retrieved_chunks)
    system_prompt = (
        "你是企业知识库问答助手，语气适合技术销售和解决方案工程师。"
        "你只能基于用户提供的资料片段回答问题。"
        "如果资料不足，请明确说明“根据当前知识库资料无法确定”。"
        "回答要结构清晰，可以引用资料来源标题。"
    )
    user_prompt = f"""用户问题：
{question}

检索资料片段：
{context}

请基于以上资料生成结构化回答。"""

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
            timeout=20.0,
        )
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        answer = response.choices[0].message.content
    except Exception as exc:
        return (
            "调用 DeepSeek API 失败，请检查网络、模型名称、API Key 或账户余额。"
            f"错误详情：{exc}"
        )

    if not answer:
        return "DeepSeek API 未返回有效回答，请稍后重试。"

    return answer.strip()


def answer_question(question: str) -> str:
    """Generate an answer based on retrieved knowledge base context."""
    # TODO: Compose retrieval, prompt formatting, and LLM response generation.
    return "知识库问答功能将在后续阶段接入。"


def analyze_requirement(requirement: str) -> str:
    """Analyze customer requirements for presales solution work."""
    requirement = requirement.strip()
    if not requirement:
        return "请输入客户需求。"

    try:
        from dotenv import load_dotenv
        from openai import OpenAI
    except ImportError as exc:
        return f"缺少必要依赖：{exc.name}，请确认 requirements.txt 中的依赖已安装。"

    load_dotenv()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return (
            "未检测到 DEEPSEEK_API_KEY。请在项目根目录创建 .env 文件，"
            "并写入 DEEPSEEK_API_KEY=你的 API Key 后重试。"
        )

    system_prompt = (
        "你是技术销售 / 解决方案工程师，擅长在售前阶段"
        "对客户需求进行简洁、专业、结构化的分析。"
        "请基于客户输入进行需求解析，不要虚构客户没有提到的信息。"
        "输出必须包含：1. 客户类型；2. 业务场景；3. 核心需求；"
        "4. 主要痛点；5. 关键约束；6. 推荐解决方向；"
        "7. 后续需要确认的问题。"
    )
    user_prompt = f"""客户需求：
{requirement}

请对以上客户需求进行结构化解析，回答要简洁、专业，适合售前沟通。"""

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
            timeout=20.0,
        )
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        analysis = response.choices[0].message.content
    except Exception as exc:
        return (
            "调用 DeepSeek API 失败，请检查网络、模型名称、API Key 或账户余额。"
            f"错误详情：{exc}"
        )

    if not analysis:
        return "DeepSeek API 未返回有效需求解析，请稍后重试。"

    return analysis.strip()


def generate_solution(requirement: str, retrieved_chunks: list[dict]) -> str:
    """Generate a presales solution proposal with DeepSeek."""
    requirement = requirement.strip()
    if not requirement:
        return "请输入客户需求。"

    if not retrieved_chunks:
        return "暂未从知识库中检索到相关资料，无法生成可靠方案。"

    try:
        from dotenv import load_dotenv
        from openai import OpenAI
    except ImportError as exc:
        return f"缺少必要依赖：{exc.name}，请确认 requirements.txt 中的依赖已安装。"

    load_dotenv()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return (
            "未检测到 DEEPSEEK_API_KEY。请在项目根目录创建 .env 文件，"
            "并写入 DEEPSEEK_API_KEY=你的 API Key 后重试。"
        )

    context = _format_retrieved_context(retrieved_chunks)
    system_prompt = (
        "你是技术销售 / 解决方案工程师，擅长基于企业知识库资料"
        "为客户生成务实、结构化的售前方案初稿。"
        "你必须基于给定客户需求和检索资料片段生成方案，"
        "不允许编造知识库中不存在的具体产品能力。"
        "如果资料不足，请明确说明“根据当前知识库资料无法确定”。"
        "输出必须包含：一、客户背景理解；二、核心需求与痛点；"
        "三、推荐解决方案；四、功能模块设计；五、实施步骤建议；"
        "六、预期价值；七、参考资料来源。"
    )
    user_prompt = f"""客户需求：
{requirement}

检索资料片段：
{context}

请基于以上资料生成结构化售前方案初稿。"""

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
            timeout=20.0,
        )
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        solution = response.choices[0].message.content
    except Exception as exc:
        return (
            "调用 DeepSeek API 失败，请检查网络、模型名称、API Key 或账户余额。"
            f"错误详情：{exc}"
        )

    if not solution:
        return "DeepSeek API 未返回有效方案，请稍后重试。"

    return solution.strip()
