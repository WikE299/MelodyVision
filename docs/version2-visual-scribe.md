# Version 2 视觉记录智能体

## 1. 目标

V2-08 增加一个不参与公开聊天的 Visual Scribe。它在每个完整对话回合后，把用户与音乐家已经说出的画面线索更新为结构化 `VisualBrief`，并为每个字段保存可验证来源。

Visual Scribe 不是 Prompt Director，也不负责创作最终画面。它宁可保留缺失和冲突，也不能为了填满字段而编造主体、地点、颜色或物件。

## 2. 更新时机

第三页通过消息顺序识别完整回合：当一条主持字幕紧跟在音乐家消息之后，说明本轮音乐家发言已经结束并交还用户。

```text
音乐家流式发言完成
  -> 状态机追加主持邀请
  -> /api/conversation/brief
  -> Visual Scribe 生成并校验字段
  -> visualBrief 写入 sessionStorage
  -> visualBriefRef 合并回 ConversationState
```

更新在后台进行，不阻塞用户阅读评论。若用户很快进入下一轮，客户端始终保留本地已知的最高 `visualBriefRef`，较晚返回的旧会话状态不能让 Brief 版本倒退。

## 3. 字段与状态

Visual Scribe 更新既有契约中的 11 个字段：

- `subject`
- `space`
- `composition`
- `motion`
- `materials`
- `palette`
- `lighting`
- `atmosphere`
- `personalMeaning`
- `mustInclude`
- `mustAvoid`

每个字段可以是：

- `missing`：没有足够证据，值必须为空且没有来源。
- `suggested`：音乐家或音乐分析提出的候选方向，用户尚未确认。
- `confirmed`：用户明确表达或确认，必须引用用户消息。
- `conflicted`：存在不能同时成立的方向，必须引用至少两个来源。

## 4. 来源映射

模型只能选择以下来源 ID：

- 公开消息的精确 `message.id`
- 特殊值 `music-profile`

服务端把它们转换为 `SourceReference`：

- 用户消息 -> `user-message`
- 音乐家消息 -> `musician-message`
- 主持字幕 -> `facilitator-subtitle`
- 音乐分析 -> `music-analysis`

每条消息来源保存最多 180 字原文摘录。未知消息 ID 会导致校验失败并进入修复循环。

## 5. 防止无来源创作

运行时执行以下硬约束：

- `confirmed` 至少包含一条用户消息来源。
- `conflicted` 至少包含两个不同来源。
- 非缺失字段必须有来源和可用值。
- 主持字幕不能单独支撑视觉字段。
- 仅凭音乐分析不能创建主体、空间、色彩、个人意义、必须包含或必须避免内容。
- 上一版已确认字段在没有新用户证据时不能降级或改写。
- 模型输出的额外字段和未知来源会被拒绝。

首次输出失败后，Agent 会携带验证错误修复一次。连续两次失败时，系统只保留上一版内容并增加 fallback 元数据，不采纳任何未验证的新线索。

## 6. Readiness

Readiness 根据 9 个核心字段的覆盖率计算，并对冲突字段扣分。`ready=true` 还必须满足：

- 存在明确主体。
- 存在空间或构图锚点。
- 用户的 `personalMeaning` 已确认。
- 核心覆盖分数至少为 0.6。

Readiness 只描述信息充分度，不取消用户提前生成的权利。

## 7. 验证结果

自动测试证明：

- 用户来源可以生成 confirmed 字段并建立 `user-message` 引用。
- 音乐家建议保持 suggested，并建立 `musician-message` 引用。
- 没有用户来源的 confirmed 会触发第二次修复。
- 伪造消息 ID 连续失败后回退为空，不产生无来源画面。
- 仅凭音乐分析创建“一座山”会被拒绝。
- 没有新用户证据时，已确认主体不能被改成其他对象。

真实模型以“向远方收紧的黑色道路、尽头必须有斜光”为用户输入时，一次生成通过：

- 确认黑色道路、黑色调、尽头斜光和 mustInclude。
- 将贴地细线、轻微颤动与持续力量保留为建议。
- 构图、材质和个人意义没有证据，因此继续缺失。
- Readiness 为 `0.667`，但因为用户个人意义尚未确认，仍保持 `collecting`。
