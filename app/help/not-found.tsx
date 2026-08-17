import { PublicLink } from "../public-link";

export default function HelpNotFound() {
  return (
    <section className="help-kb-cat">
      <h1>找不到这篇文章</h1>
      <p>链接可能已更换。回到帮助中心继续浏览。</p>
      <p>
        <PublicLink className="help-kb-article-link" href="/help">
          返回帮助中心
        </PublicLink>
      </p>
    </section>
  );
}
