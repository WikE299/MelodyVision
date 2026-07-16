# Version 2 音频分析原型报告

## 1. 范围

`V2-02` 在 `services/audio-analysis/` 中建立了独立的 Python 原型，不替换 Version 1 的 Meyda 正式链路。

原型由三层组成：

- `librosa`：节拍、起音、调性、动态、音色和结构变化。
- `CLAP`：在受控候选词中给出情绪、流派、乐器、质感、运动和空间的相对分数。
- MelodyVision derived：段落阶段、置信度、证据引用和风险警告。

输出遵循 `MusicProfile 2.0.0`，音频分析层不产生具体画面意象。

## 2. 已验证内容

- Python 3.12 环境可以安装和运行全部依赖。
- 8 首 45 秒预置音频均可完成信号分析和 CLAP 语义分析。
- MP3 可直接解码，不依赖系统级 `ffmpeg`。
- `/health` 返回分析器状态；`/analyze` 可接收 multipart 音频并返回完整 `MusicProfile`。
- 非法 `sourceKind` 返回 `422`，临时上传文件在请求结束后清理。
- CLAP 模型按需加载，并在同一服务进程内复用。
- 高拍速结果会提示半拍解释的可能，低调性置信度会原样保留。
- 没有明确内部能量峰时，分析器不会强行给段落标记“高潮”。

一次本地 CPU 验证中，模型缓存已存在时，8 首音频的完整语义分析约用 19 秒。该数字只用于证明原型可运行，不作为正式性能基准。

## 3. 初步语义结果

以下为每首样例的第一候选，仅用于暴露模型边界：

| 样例 | 情绪 | 流派 | 乐器 | 运动 |
| --- | --- | --- | --- | --- |
| Amœba | tense | electronic | strings | flowing |
| Bach Cello Prelude | hopeful | traditional-chinese | acoustic-guitar | flowing |
| Beethoven Symphony No.5 | aggressive | romantic | cello | rising |
| 二泉映月 | hopeful | baroque | woodwind | flowing |
| 茉莉花钢琴版 | melancholic | classical | piano | falling |
| Mozart Eine kleine Nachtmusik | aggressive | romantic | cello | flowing |
| West End Blues | joyful | baroque | trumpet | rising |
| 阳关三叠 | melancholic | baroque | acoustic-guitar | falling |

结果表明，CLAP 对部分整体情绪、运动和显著乐器有帮助，但对细分流派、相似弦乐音色和跨文化音乐存在明显误判。更换三种乐器提示模板后，Bach Cello Prelude 仍偏向 `acoustic-guitar`，因此该问题不能靠单句提示词修复。

所有成功的 CLAP 输出均携带 `semantic_scores_relative` 警告。下游智能体在 `V2-03` 通过之前不得把这些候选标签当作事实。

## 4. 已知限制

- BPM 置信度描述节拍间隔的规律性，不保证不存在两倍速或半速解释。
- 调性使用 chroma 与 key profile 相关性，只是候选调性，不等同于乐理标注。
- roughness 目前是 spectral flux 代理，并非心理声学粗糙度。
- CLAP 分数是同组候选词之间的相对概率，不能跨组比较，也不是分类准确率。
- 结构边界来自多特征变化峰，不保证与人工曲式标注完全一致。
- 原型最多分析 60 秒；更长音频会截断并返回警告。

## 5. V2-03 验证门槛

正式替换 Meyda 前，下一步至少需要：

1. 对 8 首已知样例建立人工参考标签。
2. 比较 Meyda 与新原型对音乐描述、音乐家评论和视觉共创的帮助程度。
3. 记录每首耗时、失败率、字段置信度和语义 Top-K 命中。
4. 决定 CLAP 字段是保留、收窄标签、增加模型，还是仅作为低权重候选。
5. 只有通过人工评价的字段才能进入音乐家共享上下文。
