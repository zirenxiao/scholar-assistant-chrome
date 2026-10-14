# 隐私政策 / Privacy Policy

**Scholar Assistant：谷歌学术学者统计**（Chrome 扩展程序）

生效日期 / Effective date: 2026-10-14

[中文](#中文) · [English](#english)

---

## 中文

### 概述

Scholar Assistant 在 Google Scholar 学者主页上显示该学者的统计信息和期刊/会议排名。本扩展**不收集、不上传、不出售**任何用户数据，也不包含任何统计分析或广告代码。

### 扩展读取的内容

- 仅在 Google Scholar 学者主页（`https://scholar.google.<国家/地区域名>/citations…`）上运行，不访问其他任何网站。
- 读取页面上公开显示的论文列表（标题、作者、发表源、引用数、年份）和引用统计。
- 为了统计该学者的全部论文，扩展会向**当前正在浏览的同一个 Google Scholar 网站**请求该主页的后续分页，相当于点击页面上的“Show more”按钮（约每秒一次）。这些请求由您的浏览器直接发往 Google Scholar，与您自己浏览该网站相同。
- 读取扩展安装包内自带的排名名单索引文件。

所有统计都在您的浏览器中本地计算，结果只显示在页面上，不会发送给开发者或任何第三方。

### 本地保存的内容

扩展使用 `chrome.storage.local` 在您的浏览器中保存以下设置：

- 界面语言（中文/英文）；
- 选择的排名名单；
- 在文章列表中显示哪些标注；
- 您为某个学者主页手动修正的署名（按该主页公开的 Scholar 用户 ID 保存）。

这些设置只保存在您的设备上，不会同步或上传；卸载扩展时会一并删除。您也可以随时在扩展中修改它们。

### 数据共享

本扩展不向开发者或任何第三方传输数据，不出售或转让用户数据，不将数据用于与扩展单一用途无关的目的，也不用于信用评估或借贷目的。

### 第三方服务

扩展只与 Google Scholar 通信，即您正在访问的网站。Google 对这些请求的处理适用 [Google 隐私政策](https://policies.google.com/privacy)。

### 政策变更

如本政策有变更，将在本页面更新并修改生效日期。

### 联系方式

如有问题，请在项目的 GitHub 仓库提交 Issue。

---

## English

### Summary

Scholar Assistant shows statistics and venue rankings for the researcher on a Google Scholar profile page. The extension **does not collect, transmit or sell** any user data, and contains no analytics or advertising code.

### What the extension reads

- It runs only on Google Scholar profile pages (`https://scholar.google.<country domain>/citations…`) and accesses no other website.
- It reads the publication list (titles, authors, venues, citation counts, years) and citation statistics publicly shown on the page.
- To cover all of the researcher's publications, it requests the remaining pages of that profile from **the same Google Scholar site you are viewing**, as Scholar's own "Show more" button does (about one request per second). These requests go directly from your browser to Google Scholar, exactly as if you browsed the site yourself.
- It reads the ranking-list index files packaged inside the extension.

All statistics are computed locally in your browser and only displayed on the page. Nothing is sent to the developer or any third party.

### What is stored locally

The extension uses `chrome.storage.local` to keep these settings in your browser:

- interface language (Chinese / English);
- the selected ranking list;
- which marks to show in the article list;
- an author name you corrected for a given Scholar profile (keyed by that profile's public Scholar user ID).

These settings stay on your device, are not synced or uploaded, and are removed when you uninstall the extension. You can change them at any time in the extension.

### Data sharing

The extension does not transfer data to the developer or any third party, does not sell or transfer user data, does not use data for purposes unrelated to its single purpose, and does not use data to determine creditworthiness or for lending purposes.

### Third-party services

The extension communicates only with Google Scholar, the site you are visiting. Google's handling of those requests is covered by the [Google Privacy Policy](https://policies.google.com/privacy).

### Changes

Any changes to this policy will be published on this page with an updated effective date.

### Contact

For questions, please open an issue in the project's GitHub repository.
