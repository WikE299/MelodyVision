# Version 2 四步流程与结果页

## 四步主流程

Version 2 的全局导航统一为：

```text
01 音乐输入 -> 02 选择导览 -> 03 共创聆听 -> 04 画作呈现
```

旧 `/generate-page` 不再渲染视觉标签选择页面，保留为服务端临时跳转并返回 `/listen`。这可以兼容旧收藏地址，同时保证主流程中不再出现第五步。

## 生成依据

结果页左侧依据栏默认收起，展开后显示：

- 用户原始画面表达
- 实际进入 Prompt Director 的 VisualBrief 字段
- 音乐家原始评论
- 生成时间、导览数量和图片模型

中文界面使用消息 ID 和字段名回查原始中文证据，不对来源进行二次改写。英文界面显示 Prompt Director 已校验的视觉翻译。旧版结果没有 source mapping 时显示兼容说明，不伪造依据。

## 重新生成

结果页重新生成使用：

- 同一最终 image Prompt
- 同一 negative Prompt
- 同一 VisualBrief 版本
- 同一 ConversationState
- 同一 MusicProfile；降级会话允许为空

请求使用 `promptOverride`，因此不会重新执行对话、Visual Scribe 或 Prompt Director。服务端仍校验 Version 2 上下文，并在生成日志中保存同一来源关系。图片接口可以进行瞬时失败重试。

重新开始才执行 `sessionStorage.clear()` 并返回首页，清除当前音频、音乐家、对话、Brief、Prompt 和结果。

## 对抗审查

- 五步导航已从全部页面移除，结果页正确高亮第 04 步。
- `/generate-page` 返回 HTTP 307，`Location` 为 `/listen`。
- 生成依据展开后，左侧依据栏、中央画作和右侧评论栏边界交集均为 0。
- 中文依据正确显示用户原话、Brief 原值和音乐家原评论。
- 依据栏可重新收起，不改变画作尺寸。
