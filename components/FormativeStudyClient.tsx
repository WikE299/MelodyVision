import Image from "next/image";
import styles from "./FormativeStudyClient.module.css";

import {
  EXPERT_DISCUSSION_QUESTIONS,
  IMAGINATION_EXAMPLES,
  MUSICIAN_PERSPECTIVES,
  RESONANCE_CASES,
} from "@/lib/formative-study";

const CONCEPT_STEPS = [
  ["01", "听见音乐", "旋律、节奏、音色进入身体"],
  ["02", "出现画面", "一个地点、人物、动作或光线"],
  ["03", "共同聆听", "音乐家用不同视角帮助追问"],
  ["04", "逐渐说清", "用户保留、修改或拒绝解释"],
  ["05", "成为图像", "画面被具象化，但仍属于用户"],
] as const;

const LISTENING_PROMPTS = ["一个地点", "一种光线", "某个动作", "一个人物", "一段记忆"] as const;

export default function FormativeStudyClient() {
  return (
    <main id="top" className={styles.page}>
      <nav className={styles.navigation} aria-label="页面导航">
        <a className={styles.brand} href="#top">
          <span>MV</span>
          <b>MelodyVision</b>
        </a>
        <div className={styles.navLinks}>
          <a href="#origin">研究初衷</a>
          <a href="#listen">聆听体验</a>
          <a href="#cases">真实案例</a>
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
          <span>MelodyVision · Resonance</span>
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
            MelodyVision 想做的不是替用户解释音乐，也不是把音高机械地换成颜色。
            它希望邀请多位音乐家与用户一起聆听，通过不同的追问，帮助用户辨认并具象化自己已经感受到的画面。
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

      <section id="ensemble" className={styles.ensemble}>
        <div className={styles.ensembleIntro}>
          <div className={styles.sectionHeading}>
            <span>04 · 为什么引入多音乐家</span>
            <h2>不是让专家替用户决定，而是让不同的耳朵帮助用户继续想象。</h2>
          </div>
          <p>
            单一模型很容易迅速给出一个看似完整的答案。多位音乐家的意义，是把聆听拆成几种互补的追问，
            让用户有机会发现、修正或拒绝解释。画面的主导权始终留在用户手里。
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
          <span>05 · 希望与专家讨论</span>
          <h2>真正需要验证的，是这些问题。</h2>
        </div>
        <ol>
          {EXPERT_DISCUSSION_QUESTIONS.map((question, index) => (
            <li key={question}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{question}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing}>
        <span>MelodyVision</span>
        <h2>让音乐引发的画面，不再只停留在一个人的脑海里。</h2>
        <p>
          这项研究关注的不是“AI 能不能画得更漂亮”，而是人能否在共同聆听中更好地理解、表达并保有自己的音乐想象。
        </p>
      </section>

      <footer className={styles.footer}>
        <span>MelodyVision · Resonance Concept Material</span>
        <div>
          {RESONANCE_CASES.map((item) => (
            <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
