# 把《余烬深牢》放到公开网址上

`index.html` 是整个游戏，**一个文件，1.5 MB**。Phaser 引擎、样式、全部像素美术都在里面，
加载完之后不发任何网络请求。所以任何能托管静态文件的地方都能直接跑，不需要构建、不需要服务端。

上传的文件**必须叫 `index.html`**，这样访问者打开域名根路径就能直接进游戏。

---

## 方案 A：GitHub Pages（不用命令行，全程网页点）

1. 打开 <https://github.com/new>，仓库名填 `ember-vault`，选 **Public**，勾上 *Add a README file*，创建。
2. 进仓库 → **Add file** → **Upload files** → 把这个文件夹里的 `index.html` 拖进去 → **Commit changes**。
3. 仓库 → **Settings** → 左侧 **Pages** → *Source* 选 **Deploy from a branch** → 分支选 `main`、目录选 `/ (root)` → **Save**。
4. 等一两分钟，页面顶部会出现网址：`https://<你的用户名>.github.io/ember-vault/`

这个链接谁都能开，不用登录任何账号。免费、无限期。

以后改了游戏，重新跑 `npm run artifact`，把新的 `dist-artifact/index.html` 覆盖上传即可。

## 方案 A′：同样是 GitHub Pages，但用命令行

```powershell
cd deploy
git init -b main
git add index.html
git commit -m "Ember Vault"
gh repo create ember-vault --public --source=. --push
gh api -X POST repos/:owner/ember-vault/pages -f "source[branch]=main" -f "source[path]=/"
```

## 方案 B：Cloudflare Pages（拖文件夹，最快）

1. 注册 <https://dash.cloudflare.com>（免费）。
2. **Workers & Pages** → **Create** → **Pages** → **Upload assets**。
3. 项目名填 `ember-vault`，把**这个 `deploy` 文件夹**整个拖进去 → 部署。
4. 得到 `https://ember-vault.pages.dev`。

Netlify 的 **Add new site → Deploy manually** 是一样的操作，结果是 `xxx.netlify.app`。

---

## 不想开网站的话

直接把 `index.html` 发给别人也行——双击就在浏览器里打开，能正常玩。
微信/邮件传文件时若被改名，让对方把后缀改回 `.html` 即可。

## 已知限制

- 布局最小宽度 740px，手机上会横向滚动；键盘操作在手机上也用不了。目前是桌面游戏。
- 瞄准方式的选择存在浏览器 `localStorage` 里，换设备不同步。
