import Link from "next/link";
import { BrandLockup } from "@/components/product-shell";

export default function NotFound() {
  return (
    <main className="product-page not-found-page">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="masthead product-masthead">
        <BrandLockup />
      </header>
      <section id="main-content" className="not-found-sheet" tabIndex={-1}>
        <p className="eyebrow">MISSING FOLIO</p>
        <h1>这份档案不在当前切片里。</h1>
        <p>地址可能写错，或该页尚未对公开版本开放。ChronoKalamos 目前只提供 742 年长安的有限入口。</p>
        <div className="not-found-actions">
          <Link className="primary-button link-as-button" href="/">回到新开始</Link>
          <Link className="secondary-button link-as-button" href="/support">查看支持说明</Link>
        </div>
      </section>
    </main>
  );
}
