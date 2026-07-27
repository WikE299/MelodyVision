import Image from "next/image";
import styles from "./FormativeStudyClient.module.css";

import {
  ARTICULATION_STEPS,
  FORMATIVE_DISCUSSION_QUESTIONS,
  IMAGINATION_EXAMPLES,
  MUSICIAN_PERSPECTIVES,
  RESONANCE_CASES,
} from "@/lib/formative-study";

const CONCEPT_STEPS = [
  ["01", "听见音乐", "旋律、节奏、音色进入身体"],
  ["02", "出现画面", "一个地点、人物、动作或光线"],
  ["03", "尝试描述", "把短暂而模糊的意象说出来"],
  ["04", "拆解元素", "辨认主体、空间、光色与动作"],
  ["05", "成为图像", "画面被具象化，但仍属于用户"],
] as const;

const LISTENING_PROMPTS = ["一个地点", "一种光线", "某个动作", "一个人物", "一段记忆"] as const;

export default function FormativeStudyClient() {
  return (
    <main id="top" className={styles.page}>
      <nav className={styles.navigation} aria-label="页面导航">
        <a className={styles.brand} href="#top">
          <span>共</span>
          <b>共鸣</b>
        </a>
        <div className={styles.navLinks}>
          <a href="#origin">研究初衷</a>
          <a href="#listen">聆听体验</a>
          <a href="#cases">真实案例</a>
          <a href="#gap">表达断点</a>
          <a href="#ensemble">多音乐家</a>
          <a href="#questions">讨论问题</a>
        </div>
        <span className={styles.materialLabel}>概念展示材料</span>
      </nav>

      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          src="/formative-study/resonance-hero.webp"
          alt="一位聆听者面前，声音涟漪逐渐展开成河流、山脉和风中的草地"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroCopy}>
          <span>Formative Study · Resonance</span>
          <h1 id="hero-title">共鸣</h1>
          <p>听见一首音乐时，<br />你脑海里出现了什么？</p>
          <a href="#origin">从这个问题开始</a>
        </div>
        <p className={styles.heroCaption}>概念示意：声音并不直接变成图像，它先经过人的感受与想象。</p>
      </section>

      <section id="origin" className={styles.origin}>
        <div className={styles.sectionHeading}>
          <span>01 · 研究初衷</span>
          <h2>音乐先成为一个人的画面，之后才可能成为一张图。</h2>
        </div>
        <div className={styles.originCopy}>
          <p>
            人在听音乐时，脑海里可能出现一条路、一个房间、一束光、某个人的背影，
            也可能只是颜色、材质和运动。这个画面往往私人、短暂、难以描述，却是音乐体验中非常真实的一部分。
          </p>
          <p>
            这项形成性研究想了解：人是否愿意把这样的内在画面表达出来；当画面难以说清时，
            怎样的聆听、追问与共同理解，能够帮助它逐渐变得具体，同时不覆盖原本的个人感受。
          </p>
        </div>
        <div className={styles.conceptPath} aria-label="从音乐到用户画面的概念路径">
          {CONCEPT_STEPS.map(([number, title, detail]) => (
            <div key={number}>
              <span>{number}</span>
              <b>{title}</b>
              <small>{detail}</small>
            </div>
          ))}
        </div>
        <p className={styles.thesis}>
          系统的价值不在于给出“正确画面”，而在于帮助一个人看见自己的想象。
        </p>
      </section>

      <section id="listen" className={styles.listening}>
        <div className={styles.listeningInner}>
          <div className={styles.sectionHeading}>
            <span>02 · 一次聆听</span>
            <h2>先听。暂时不要分析。</h2>
          </div>
          <div className={styles.listenBody}>
            <div>
              <p>
                播放这段音乐的前 15 秒。闭上眼睛，不寻找答案，只留意第一个出现的视觉线索。
              </p>
              <audio
                controls
                preload="metadata"
                src="/preset-audio/clips/bach-cello-prelude-clip.mp3"
                aria-label="播放巴赫大提琴组曲示例"
              />
              <small>Bach《Cello Suite No.1 Prelude》· CC BY 4.0</small>
            </div>
            <blockquote>
              “它首先像什么？”
              <span>不是它应该像什么，而是你真的看见了什么。</span>
            </blockquote>
          </div>
          <div className={styles.listeningPrompts} aria-label="聆听时可以留意的画面线索">
            {LISTENING_PROMPTS.map((prompt) => <span key={prompt}>{prompt}</span>)}
          </div>
        </div>
      </section>

      <section className={styles.imaginations}>
        <div className={styles.sectionHeading}>
          <span>同一段声音，不止一种画面</span>
          <h2>意象可能具体，也可能只是一种正在发生的变化。</h2>
        </div>
        <div className={styles.imageSequence}>
          {IMAGINATION_EXAMPLES.map((example, index) => (
            <figure key={example.src}>
              <Image src={example.src} alt={example.alt} width={900} height={900} sizes="(max-width: 760px) 100vw, 33vw" />
              <figcaption><span>0{index + 1}</span>{example.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.imageNote}>项目生成图像示意。它们用于说明意象的差异，不代表音乐存在唯一视觉答案。</p>
      </section>

      <section id="cases" className={styles.cases}>
        <div className={styles.sectionHeading}>
          <span>03 · 真实案例</span>
          <h2>视听结合从来不只有一种方式。</h2>
        </div>
        <div className={styles.caseGrid}>
          {RESONANCE_CASES.map((item, index) => (
            <article key={item.id} className={styles.caseStudy}>
              <figure className={styles.caseVisual}>
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  width={item.image.width}
                  height={item.image.height}
                  sizes="(max-width: 760px) 100vw, 33vw"
                />
                <figcaption>
                  <span>0{index + 1}</span>
                  <a href={item.image.creditUrl} target="_blank" rel="noreferrer">
                    {item.image.creditLabel}
                  </a>
                  <small>{item.rights}</small>
                </figcaption>
              </figure>
              <div className={styles.caseCopy}>
                <small>{item.label}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <p className={styles.caseRelevance}>{item.relevance}</p>
                <div className={styles.caseLinks}>
                  {item.experience ? (
                    <a className={styles.experienceLink} href={item.experience.url} target="_blank" rel="noreferrer">
                      {item.experience.label}
                    </a>
                  ) : null}
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="gap" className={styles.articulation}>
        <div className={styles.sectionHeading}>
          <span>04 · 表达的断点</span>
          <h2>脑海里“有画面”，不等于能够把它完整说出来。</h2>
        </div>
        <p className={styles.articulationLead}>
          内在意象常常先以气氛、方向或一个瞬间整体出现。真正困难的部分，是把这个整体转换成主体、
          场景、构图、光色、材质、动作与叙事等可以被描绘的决定。
        </p>
        <div className={styles.articulationFlow}>
          {ARTICULATION_STEPS.map((step, index) => (
            <article key={step.id}>
              <span>0{index + 1} · {step.stage}</span>
              <strong>{step.example}</strong>
              <p>{step.insight}</p>
            </article>
          ))}
        </div>
        <div className={styles.bridge}>
          <div>
            <span>单一视角的限制</span>
            <p>一个人或一种分析方式，往往只抓住节奏、情绪、文化联想或场景中的一部分，也可能过早把模糊感受固定成一个答案。</p>
          </div>
          <strong aria-hidden="true">→</strong>
          <div>
            <span>需要被验证的帮助方式</span>
            <p>让几位音乐家从互补角度分别追问同一段音乐，再由聆听者比较、保留、修改或拒绝，是否能更完整地说清自己的画面？</p>
          </div>
        </div>
        <p className={styles.bridgeConclusion}>
          因此，多位音乐家不是为了增加“权威意见”，而是为了覆盖一幅画面所需要的不同线索。
        </p>
      </section>

      <section id="ensemble" className={styles.ensemble}>
        <div className={styles.ensembleIntro}>
          <div className={styles.sectionHeading}>
            <span>05 · 为什么需要多位音乐家</span>
            <h2>一位聆听者很难同时听见结构、触感、语境与故事。</h2>
          </div>
          <p>
            多位音乐家的价值不在于人数，而在于分工：他们从同一段声音中找出不同证据，
            帮助聆听者把模糊感受拆成可以判断的画面线索。最终采用哪些线索，仍由聆听者决定。
          </p>
        </div>
        <div className={styles.userVoice}>
          <span>用户的内在画面</span>
          <strong>“我好像看见……”</strong>
          <small>所有音乐家都从这句话继续，而不是从自己的答案开始。</small>
        </div>
        <div className={styles.perspectives}>
          {MUSICIAN_PERSPECTIVES.map((perspective, index) => (
            <article key={perspective.id}>
              <span>0{index + 1}</span>
              <h3>{perspective.name}</h3>
              <p>{perspective.question}</p>
              <small>{perspective.contribution}</small>
            </article>
          ))}
        </div>
        <div className={styles.notVoting}>
          <b>不是四票投票</b>
          <span>是四种帮助用户说清画面的方式</span>
        </div>
      </section>

      <section id="questions" className={styles.questions}>
        <div className={styles.sectionHeading}>
          <span>06 · 希望一起讨论</span>
          <h2>真正需要验证的，是这些问题。</h2>
        </div>
        <ol>
          {FORMATIVE_DISCUSSION_QUESTIONS.map((question, index) => (
            <li key={question}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{question}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing}>
        <span>形成性研究材料</span>
        <h2>让音乐引发的画面，不再只停留在一个人的脑海里。</h2>
        <p>
          这项研究关注的不是“AI 能不能画得更漂亮”，而是人能否在共同聆听中更好地理解、表达并保有自己的音乐想象。
        </p>
      </section>

      <footer className={styles.footer}>
        <span>共鸣 · Formative Study Material</span>
        <div>
          {RESONANCE_CASES.map((item) => (
            <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
