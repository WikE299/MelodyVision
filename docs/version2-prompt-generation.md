# Version 2 Prompt 与生图链路

## 调用路径

```text
第三页生成画作
-> 对话状态机 requestGeneration
-> 等待或补齐同版本 VisualBrief
-> /api/generate
-> Prompt Director 校验与修复循环
-> 图片接口重试
-> 本地保存与结果页
```

第三页不再依赖旧第四页的风格、情绪和色调标签。Version 2 请求使用自动预设，具体视觉方向来自共创上下文。

## 服务端事实来源

Version 2 请求必须同时提供：

- `ConversationState`
- `VisualBrief`
- 可选的 `MusicProfile`；新版分析服务降级时允许为空

接口验证三者 ID、Brief 版本和所有 source reference。音乐家评论和用户表达由服务端从已校验的 `ConversationState.messages` 重新派生，前端提交的重复文本不会成为事实来源。前端只提供共鸣权重。

## Prompt Director 输入

`coCreation` 输入包含：

- 压缩后的节奏、调性、动态、音色、段落与语义候选
- 所有非空 VisualBrief 字段、字段状态及其精确 source reference ID
- VisualBrief 引用的消息摘要
- 所有用户消息的独立 primary source

确认字段优先于建议字段；`mustInclude` 与 `mustAvoid` 始终是硬约束；MusicProfile 只能补充动势、密度、动态和材质，不能覆盖用户确认内容。

## 输出校验

Prompt Director 除旧版视觉计划外，必须返回：

- `visualBriefMappings`：每个非空 Brief 字段恰好一次，状态和 source ID 必须完全一致
- `userSourceMappings`：每条用户消息恰好一次，优先级必须为 primary

任何字段遗漏、来源伪造、优先级错误、非法人物/文字内容或 Prompt 结构错误都会触发最多两次修复。修复仍失败时，确定性 fallback 保留 VisualBrief 和用户原始表达，不退回只依赖音乐家评论的旧逻辑。

正常输出后，服务端再次追加已经验证的用户视觉翻译和确认字段，确保最终图片 Prompt 不会静默丢失用户锚点。`mustAvoid` 同步追加到 negative prompt。

## 图片生成稳定性

图片接口最多尝试两次，日志记录实际尝试次数、Prompt Director 每次校验结果、最终 Prompt、source mapping 和各阶段耗时。重新生成仍使用结果页保存的同一最终 Prompt，不重新执行对话与 Prompt Director。

## 对抗审查

- 缺少合法 schema 的伪造 Version 2 请求返回 HTTP 400，不进入模型链路。
- 首次真实链路因 Prompt 出现禁用词触发一次修复，修复后成功生成。
- 加入独立用户来源映射后再次真实生成，Prompt Director 首次输出即通过，校验错误和警告均为零。
- 用户消息被映射为 primary，四个有效 Brief 字段的状态和 source ID 完全一致。
- 图片接口一次成功，生成结果准确呈现用户指定的深蓝河流、夜色、暖金色水面光和希望感。
