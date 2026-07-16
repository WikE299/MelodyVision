# MelodyVision Version 2 数据契约

Version 2 使用三个 JSON 可序列化的核心对象连接音频分析、共创对话和图像生成。TypeScript 定义位于 `lib/contracts/`。

## MusicProfile

`MusicProfile` 是音频分析服务的标准输出。它负责描述音乐证据，不负责决定最终画面。

主要内容：

- 音频来源与时长
- 分析器、模型和版本
- 节奏、调性、动态和音色
- 基于真实边界的段落结构
- 情绪、乐器、质感、运动和空间语义分数
- 每项判断对应的证据和置信度
- 分析警告

约束：

- 所有预测值的 `confidence` 或 `score` 取值范围为 `0-1`。
- 音频分析层不输出具体主体、场景或其他 `visualHints`。
- 段落时间只用于内部证据定位，不要求音乐家在可见评论中提到时间码。
- `analyzers` 必须记录实际使用的库、模型和版本，保证实验可复现。

## ConversationState

`ConversationState` 是共创聆听室的唯一会话状态，记录选中的音乐家、共享消息、轮次和发言权。

默认对话规则由 `DEFAULT_CONVERSATION_TURN_POLICY` 固定：

- 音乐家最多连续发言两次。
- 用户每次表达后最多由两位音乐家回应。
- 默认最多三轮用户参与。
- 用户可以随时打断。
- 用户可以提前生成。

展示约束：

- 音乐家消息使用 `speech-bubble`。
- 主持消息使用 `stage-subtitle`。
- 主持人不拥有可见头像，不作为第五位人物出现。
- `musicianMemory.preparedPerspective` 只保存简洁的结构化观点，不保存模型思维过程。

## VisualBrief

`VisualBrief` 是视觉记录智能体在每个完整回合后更新的画面意图。

包含以下字段：

- 主体与空间
- 构图与运动
- 材质与色彩
- 光线与氛围
- 用户个人意义
- 必须包含与必须避免的内容

每个字段包含：

- 当前值
- `missing`、`suggested`、`confirmed` 或 `conflicted` 状态
- 指向音乐证据、音乐家消息或用户消息的来源引用

`readiness` 只表示信息是否足以进入生图，不阻止用户根据 `ConversationState.turnPolicy.userMayGenerateEarly` 提前生成。

## 版本规则

- 当前契约版本为 `2.0.0`。
- 数据库存储完整对象时必须同时保存 `schemaVersion`。
- 字段含义发生不兼容变化时升级主版本。
- 仅增加可选字段时升级次版本。
- Python 音频服务必须返回与 `MusicProfile` 等价的 JSON，正式接入时增加运行时校验。
