"use client";

import { ProductPageShell } from "@/components/product-shell";
import { localeOptions, useProductPreferences } from "@/lib/ui/preferences";

const localizationRows = [
  { code: "zh", language: "中文", interface: "已校验", history: "已完成内部校验", status: "主要语言" },
  { code: "en", language: "English", interface: "可用", history: "边界说明与部分内容", status: "辅助语言" },
  { code: "fr", language: "Français", interface: "测试中", history: "未完成", status: "仅界面翻译" },
  { code: "el", language: "Ελληνικά", interface: "测试中", history: "未完成", status: "仅界面翻译" },
  { code: "ru", language: "Русский", interface: "测试中", history: "未完成", status: "仅界面翻译" },
] as const;

export default function SettingsPage() {
  const preferences = useProductPreferences();

  return (
    <ProductPageShell
      current="settings"
      eyebrow="ARCHIVE / 03"
      title="个人设置"
      intro="偏好只改变界面表现。它们不会改写史料标签、游戏规则、来源或存档权限。"
    >
      <div className="settings-grid">
        <section className="settings-card" aria-labelledby="motion-title">
          <p className="eyebrow">MOTION</p>
          <h2 id="motion-title">动态与眩光</h2>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={preferences.lowMotion}
              onChange={(event) => preferences.setLowMotion(event.target.checked)}
            />
            <span>
              <strong>低动态模式</strong>
              <small>停止非必要动画、平滑滚动和装饰性位移。系统“减少动态”偏好会作为首次默认值。</small>
            </span>
          </label>
        </section>

        <section className="settings-card" aria-labelledby="text-title">
          <p className="eyebrow">READING</p>
          <h2 id="text-title">阅读密度</h2>
          <fieldset className="segmented-control">
            <legend>文字大小</legend>
            <label>
              <input
                type="radio"
                name="text-scale"
                value="standard"
                checked={preferences.textScale === "standard"}
                onChange={() => preferences.setTextScale("standard")}
              />
              <span>标准</span>
            </label>
            <label>
              <input
                type="radio"
                name="text-scale"
                value="large"
                checked={preferences.textScale === "large"}
                onChange={() => preferences.setTextScale("large")}
              />
              <span>较大</span>
            </label>
          </fieldset>
          <fieldset className="segmented-control">
            <legend>界面密度</legend>
            {(["compact", "standard", "comfortable"] as const).map((density) => (
              <label key={density}>
                <input
                  type="radio"
                  name="interface-density"
                  value={density}
                  checked={preferences.density === density}
                  onChange={() => preferences.setDensity(density)}
                />
                <span>{{ compact: "紧凑", standard: "标准", comfortable: "宽松" }[density]}</span>
              </label>
            ))}
          </fieldset>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(event) => preferences.setHighContrast(event.target.checked)}
            />
            <span>
              <strong>高对比档案</strong>
              <small>提高墨色、边框与纸面反差；不改变史料标签含义。</small>
            </span>
          </label>
        </section>

        <section className="settings-card" aria-labelledby="game-title">
          <p className="eyebrow">GAME DEFAULTS</p>
          <h2 id="game-title">游戏默认视图</h2>
          <fieldset className="segmented-control">
            <legend>进入游戏后</legend>
            <label>
              <input type="radio" name="evidence-default" checked={preferences.evidenceDefault === "game"} onChange={() => preferences.setEvidenceDefault("game")} />
              <span>游戏视图</span>
            </label>
            <label>
              <input type="radio" name="evidence-default" checked={preferences.evidenceDefault === "evidence"} onChange={() => preferences.setEvidenceDefault("evidence")} />
              <span>证据视图</span>
            </label>
          </fieldset>
          <p className="translation-warning"><strong>这只改变信息展开方式。</strong><span>规则、来源和 provisional 状态始终存在，不会被隐藏或改写。</span></p>
        </section>

        <section className="settings-card settings-language" aria-labelledby="language-title">
          <p className="eyebrow">LANGUAGE STATUS</p>
          <h2 id="language-title">界面语言</h2>
          <label className="select-field">
            当前界面偏好
            <select
              value={preferences.locale}
              onChange={(event) => preferences.setLocale(event.target.value as typeof preferences.locale)}
            >
              {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="translation-warning" role="note">
            <strong>法语、希腊语和俄语仅处于界面翻译状态。</strong>
            <span>它们不是完整史实翻译，也未经过相应语言的历史内容审校。</span>
          </div>
          <div className="table-scroll" tabIndex={0} aria-label="语言完成状态，可横向滚动">
            <table>
              <caption className="sr-only">五种语言的界面与历史内容完成状态</caption>
              <thead><tr><th>语言</th><th>界面</th><th>历史内容</th><th>公开状态</th></tr></thead>
              <tbody>
                {localizationRows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">{row.language}</th>
                    <td>{row.interface}</td>
                    <td>{row.history}</td>
                    <td><span className={row.status === "仅界面翻译" ? "translation-chip warning" : "translation-chip"}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <p className="preference-note" role="status">
        设置保存在当前浏览器，不上传到个人资料。清除站点数据后会恢复默认值。
      </p>
    </ProductPageShell>
  );
}
