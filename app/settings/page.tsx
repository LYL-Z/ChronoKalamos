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
