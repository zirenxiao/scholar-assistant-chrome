# Chrome Web Store：Privacy 表单填写内容

以下英文文本可直接粘贴到开发者后台 **Privacy** 页面对应字段（审核团队以英文为主）。每段后附中文说明。

---

## Single purpose description

```
Scholar Assistant shows statistics about the researcher whose Google Scholar profile page (scholar.google.*/citations?user=...) is open: citation metrics (h-index, g-index, citations per year), first-, last- and corresponding-author counts, co-authors, publication venues, and venue rankings from public lists (CCF, JCR, CAS journal ranking, XR journal ranking, international journal early warning list). It adds a statistics section to the profile's "Cited by" box, marks each paper in the profile's article list with the scholar's authorship role and the venue's ranking, and shows the same venue rankings under each result on Google Scholar search pages. It does nothing on any other site.
```

> 单一用途：在 Google Scholar 学者主页上显示该学者的统计信息与期刊/会议排名，在文章列表中标注一作/通讯和排名，并在 Scholar 搜索结果中显示期刊/会议排名；不在其他网站运行。

---

## storage justification

```
chrome.storage.local stores the user's settings only, chosen in the toolbar popup or the panel: the interface language (Chinese or English), which ranking lists are enabled, the selected ranking list, which marks to show in the article list and search results, and an optional author name the user corrected for a given Scholar profile (keyed by that profile's public Scholar user ID). These settings stay in the browser, are never sent anywhere, and are removed when the extension is uninstalled.
```

> storage 权限只用于在本地保存设置弹窗中的设置（界面语言、启用的名单、标注开关）、所选排名名单和用户手动修正的署名；不上传。

---

## Host permission justification

```
Content scripts run only on Google Scholar profile pages (https://scholar.google.<country domain>/citations*) and search result pages (.../scholar*), repeated for Scholar's country domains because match patterns cannot wildcard top-level domains. On profile pages they read the publication list and request the remaining pages of the same profile from the same Scholar domain (as Scholar's "Show more" button does, about one request per second), then insert the statistics and mark the article list. On search pages they read only each result's venue name and add ranking badges; no requests are made. No other site is accessed and nothing is sent to any server other than the Scholar site being viewed. The extension's own stylesheet and packaged ranking index (src/panel.css, index/*) are web-accessible only to these Scholar origins so the content script can load them.
```

> 主机权限：内容脚本只在各国家/地区域名的 Google Scholar 学者主页和搜索结果页运行（匹配模式无法通配顶级域名，所以逐一列出）。学者主页上读取论文列表，并向同一个 Scholar 网站请求该主页的后续分页（等同“Show more”，约每秒一次）；搜索结果页上只读取每条结果的发表源名称并显示排名，不发出任何请求。不访问其他网站，不向任何其他服务器发送数据。

---

## Are you using remote code?

选择 **No, I am not using remote code**。

所有 JavaScript 都打包在扩展内（`src/`）；`index/` 中的排名索引是随扩展打包的 JSON 数据文件，不是代码；没有 `eval`、`new Function` 或外部脚本。

---

## Data usage — What user data do you plan to collect?

**全部不勾选。**

“Collect” 指把数据从用户设备传出给开发者或第三方。本扩展：

- 读取的 Scholar 页面内容（Website content）只在浏览器本地计算统计，不上传、不保存到任何服务器；
- 发往 Google Scholar 的请求就是用户正在访问的网站本身，与用户自己浏览相同；
- 本地保存的只有显示设置（见上文），不属于所列任何类别；
- 没有统计分析、广告或任何第三方代码。

如果希望更保守，可以勾选 **Website content**（扩展会读取 Scholar 页面上的论文列表），但这不改变“不上传数据”的事实；勾选后商店页面会显示“处理网站内容”。

---

## I certify that the following disclosures are true

三项**全部勾选**（均属实）：

- [x] I do not sell or transfer user data to third parties, apart from the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## Privacy policy URL

隐私政策见仓库根目录的 `PRIVACY.md`（中英文）。推送到 GitHub 后填写其地址，例如：

```
https://github.com/<你的用户名>/google-scholar-assistant/blob/main/PRIVACY.md
```

（把 `<你的用户名>` 和仓库名换成实际值；仓库需为公开，审核人员才能访问。）

---

## 关于 “in-depth review” 提示

后台提示的 “Because of the host permission, your extension may require an in-depth review” 是因为内容脚本需要在 Google Scholar 网站上运行，这是本扩展功能所必需的，无法去掉。已做的收敛：

- 只匹配 `/citations*`（学者主页）和 `/scholar*`（搜索结果）路径，而不是整个 Scholar 网站；
- 没有 `host_permissions`，也没有 `<all_urls>`；
- 扩展资源（样式与排名索引）只对 Scholar 域名可访问（此前为所有 HTTPS 网站，已收紧）。
