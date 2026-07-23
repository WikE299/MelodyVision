# MelodyVision

<p align="center">
  <a href="./README.md">English</a>
  · <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img src="./app/opengraph-image.png" alt="多路音乐轨迹穿过琥珀晶体，转化为共同创造的视觉景观" width="100%" />
</p>

<p align="center">
  <strong>一个基于音乐证据、通过对话展开的音乐视觉人机共创系统。</strong><br />
  让音乐分析、人的想象与多视角对话共同形成一幅可追溯的画面。
</p>

<p align="center">
  <a href="https://melodyvision-five.vercel.app">在线原型</a>
  · <a href="./docs/melodyvision-research-architecture.svg">系统架构图</a>
  · <a href="./docs/version2-study-protocol.md">研究协议</a>
  · <a href="./docs/deployment-online.md">部署指南</a>
</p>

> [!NOTE]
> MelodyVision 是一个用于研究 AI 辅助音乐视觉化与人机共创的研究原型，并非通用音乐分析服务。模型生成的音乐语义只作为待验证的候选解释，不被视为客观事实。

## MelodyVision 能做什么

MelodyVision 将一次聆听转化为四步共创过程：

1. **选择音乐**：使用内置示例、Jamendo 搜索，或上传本地 MP3、WAV、FLAC、OGG 文件。
2. **选择聆听方式**：进入角色化音乐家多视角体验，或与单一对话引导者交流。
3. **聆听并表达画面**：通过四轮引导，依次探索主体与空间、运动与构图、光线与材质，以及个人意义。
4. **生成并评价作品**：最终提示词可以追溯到音乐证据、AI 提供的不同视角和参与者自己的原话。

系统还会使用相同的音乐分析结果与图像模型配置，生成一张仅由音乐驱动的 Baseline 作品。Baseline 无法读取对话、视觉简报或用户表达，因此可以用于比较“直接生成”与“对话式共创”的差异。

## 它有什么不同

许多音乐转图像系统会把完整过程压缩成一条不透明的提示词。MelodyVision 则将中间推理产物保持为明确、可序列化的数据对象：

```text
音频
  -> MusicProfile
  -> ConversationState
  -> VisualBrief
  -> PromptDirectorInput
  -> 生成画作
```

| 数据契约 | 职责 |
| --- | --- |
| `MusicProfile` | 描述节奏、调性、动态、音色、结构、证据、置信度和分析器警告，不直接规定具体视觉场景。 |
| `ConversationState` | 管理选中的视角、共享对话、发言权、轮次限制、中断和生成准备状态。 |
| `VisualBrief` | 保存主体、空间、构图、运动、材质、色彩、光线、氛围、意义和约束，并为每个字段记录来源。 |
| `PromptDirectorInput` | 经过验证的生成输入，保留用户的关键意象，并将视觉决策映射回原始证据。 |

这种以数据契约驱动的设计同时服务于用户体验和研究分析：最终图像不是系统唯一保留的结果。

## 交互条件

当前研究协议比较两种完整的交互设计：

| 条件 | 体验 |
| --- | --- |
| `multi_agent` | 参与者选择角色化的音乐家视角，并依次看到彼此独立、具有差异的音乐解释。 |
| `single_agent` | 一位可见的共创引导者，以连续对话的形式支持同样的四轮视觉表达。 |

本项目**不主张**单独识别 Agent 数量带来的因果效应。冻结后的研究主张、测量指标、Baseline 角色和评价顺序记录在 [V2 研究协议](./docs/version2-study-protocol.md) 中。

## 系统架构

```text
浏览器
  ├─ Next.js / React 交互界面
  ├─ 本地上传、预置音乐和 Jamendo 搜索
  └─ 会话状态与 NDJSON 流式对话
          │
          ├─ 音频分析
          │    ├─ 本地：FastAPI + librosa（可选 CLAP）
          │    └─ 线上：Vercel Python + librosa
          │
          ├─ 智能体编排
          │    ├─ 音乐家智能体或单一引导者
          │    ├─ 确定性对话状态机
          │    ├─ Facilitator
          │    └─ Visual Scribe
          │
          ├─ Prompt Director + 校验与修复
          ├─ DashScope 图像生成
          └─ 本地 SQLite / 线上 Supabase PostgreSQL 与 Storage
```

线上路径通过签名 URL 将私有音频直接上传到 Supabase。分析器最多处理音频前 60 秒，并在分析结束后删除临时音频对象。LLM 与图像生成服务的密钥始终保留在服务端。

## 技术栈

- **应用层：** Next.js 16、React 19、TypeScript、Tailwind CSS 4
- **音频分析：** Python 3.12、FastAPI、librosa、NumPy、SciPy、SoundFile，以及基于 PyTorch 和 Transformers 的可选 CLAP
- **浏览器降级分析：** Web Audio API 与 Meyda，仅在显式开启降级模式时使用
- **AI 编排：** OpenAI 兼容的 Node SDK，可配置对话模型服务地址
- **图像生成：** DashScope 兼容的图像接口，当前配置为 Wan 图像模型系列
- **数据持久化：** 本地开发使用 Node SQLite；线上使用 Supabase PostgreSQL 与 Storage
- **音乐搜索：** Jamendo API，保留许可证信息，并限制可下载音频来源
- **部署交付：** Vercel、Supabase、GitHub Actions，以及手动启用的 Windows 自托管备用路径

## 本地运行

### 环境要求

- Node.js 24
- Python 3.12
- 已配置的对话模型与图像生成服务凭证

### 安装

```bash
git clone https://github.com/WikE299/MelodyVision.git
cd MelodyVision
npm install
cp .env.example .env.local

cd services/audio-analysis
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd ../..
```

为了完成完整的图像生成流程，至少需要在 `.env.local` 中配置模型凭证：

```text
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
DASHSCOPE_API_KEY=
IMAGE_MODEL=wan2.7-image
JAMENDO_CLIENT_ID=
```

随后同时启动 Next.js 应用与本地音频分析服务：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。本地开发默认使用 SQLite，并关闭 CLAP，以获得更可预测的启动过程。如需主动开启语义分析，请阅读[音频分析服务指南](./services/audio-analysis/README.md)。

## 验证

```bash
npm test
npm run lint
npm run build

cd services/audio-analysis
.venv/bin/python -m unittest discover -s tests -v
```

CI 还会将所有 Supabase migration 应用到一个全新的 PostgreSQL 实例。生产部署会使用真实音频检查公开应用，但不会触发付费的 LLM 或图像生成请求。

## 仓库结构

```text
app/                         Next.js 页面与服务端路由
components/                  共享界面组件
lib/agents/                  音乐家、引导者、Facilitator 与 Visual Scribe
lib/contracts/               MusicProfile、ConversationState 与 VisualBrief
lib/conversation/            轮次协议、状态机、流式传输与生成保护
lib/audio/                   音频目录、浏览器分析、适配器与外部音乐
lib/prompts/                 Prompt Director 与生成约束
lib/db/                      研究数据、导出、实验 Trial 与评价
services/audio-analysis/     FastAPI/librosa/CLAP 音频分析服务
api/audio-profile.py         Vercel Python 音频分析入口
supabase/migrations/         PostgreSQL 与 Storage 数据结构
tests/                       Node 数据契约与工作流测试
docs/                        架构、实现、审查与研究文档
```

## 研究与数据说明

- 上传音频只会被临时处理；系统保留结构化分析和文件元数据，不保留原始上传音频。
- 只有配置 `EXPERIMENT_EXPORT_TOKEN` 后，实验数据导出接口才会启用。
- 当前 Supabase 部署方案中的生成作品存储允许公开读取；正式研究必须明确告知参与者，或修改相应存储策略。
- 三份内置录音（《茉莉花》《阳关三叠》《二泉映月》）的具体录音版权仍未核实。在公开展示或正式研究前，应当替换、取得授权或从正式环境中移除。其他目录条目保留了来源及 Creative Commons / 公版授权信息。
- 当前评估尚不支持将 CLAP 的流派和乐器预测视为已验证标签，因此这些结果不会进入下游事实性上下文。

如需了解当前限制和面向 CHI 投稿的发布阻塞项，请阅读 [V2 审查报告](./docs/chi-review-audit-v2.md)。

## 文档

- [研究系统架构](./docs/melodyvision-research-architecture.svg)
- [Version 2 数据契约](./docs/version2-contracts.md)
- [音频分析方案对比](./docs/version2-audio-analysis-comparison.md)
- [对话编排](./docs/version2-conversation-orchestration.md)
- [共享流式对话](./docs/version2-shared-streaming-conversation.md)
- [Visual Scribe](./docs/version2-visual-scribe.md)
- [提示词与图像生成链路](./docs/version2-prompt-generation.md)
- [研究协议](./docs/version2-study-protocol.md)
- [线上部署](./docs/deployment-online.md)

## 项目状态

MelodyVision V2 已具备完整的端到端原型、配对 Baseline 生成、版本化研究数据、受保护的数据导出、CI 和生产环境 smoke test。下一阶段目标是开展受控 Pilot，重点检验流程理解、认知负荷、生成延迟、操纵检验、数据治理和图像忠实度。

本项目尚未声明覆盖整个仓库的开源许可证。在没有明确许可的情况下，不应默认复用源代码或仓库媒体；单个素材应以各自声明的授权范围为准。
