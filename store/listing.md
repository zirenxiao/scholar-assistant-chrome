# Chrome Web Store：商品详情（Store listing）描述

商店的 Description 字段只显示纯文本（不渲染 Markdown），以下内容已按纯文本排版，直接复制代码块内的文字即可。
中文用于默认语言（zh_CN），英文用于 English 本地化描述。

---

## 中文（zh_CN）

```
Scholar Assistant 是一个 Google Scholar（谷歌学术）学者主页统计插件。打开任意学者主页，插件会自动加载该学者的全部论文，在右侧“Cited by”区域下方给出完整的学术统计，并在左侧文章列表中直接标注每篇论文的一作/通讯身份和期刊会议等级（CCF、JCR、中科院分区、新锐分区、国际期刊预警名单）。在 Scholar 中搜索论文时，每条搜索结果下方也会显示该期刊/会议的排名。

适合：评估学者与合作者、准备简历和职称/求职/基金材料、筛选导师或审稿人、快速了解一位学者在哪些期刊会议发表论文。

━━━━━━━━━━━━━━━━━━━━
■ 主要功能
━━━━━━━━━━━━━━━━━━━━

【一、学者统计（显示在 Cited by 下方）】
• 论文数、总引用，以及第一作者、末位作者、通讯作者论文数，各自的引用数和 h 指数
• 平均作者数、作者数中位数，署名位置分布图
• h 指数、g 指数、i10 指数、e 指数、m 指数、学术年龄、年均发文
• 篇均引用、引用中位数、最高单篇引用、零引用论文数、h 核心引用占比
• 近 5 年发文和引用、上一年引用及同比增长
• 图表：每年获得引用、每年发表论文、论文引用次数分布

【二、期刊/会议排名】
内置 5 个常用名单，每篇论文自动匹配：
• CCF 推荐目录 2026（A / B / C 类，期刊和会议）
• 中科院分区表 2025（1–4 区，含 Top 期刊和预警标注）
• JCR 2025（Q1–Q4 分区，含影响因子 IF）
• 新锐期刊分区 2026（1–4 区，含 Top 和预警标记）
• 国际期刊预警名单 2025
每个名单都会统计各等级论文数、引用数、一作/通讯篇数、期刊/会议构成；JCR 还给出平均影响因子。收录论文列表可按等级、Top、预警筛选。

【三、左侧文章列表标注】
• 一作、通讯作者论文整行高亮，并显示“一作”“通讯”标签，学者本人姓名加粗
• 每篇论文显示命中的等级标签，例如 CCF-A、中科院-1区 Top、JCR-Q1 · IF 9.1、新锐-2区
• 最高等级加粗显示，预警期刊以红色标出
• 点击“Show more”新加载的论文也会自动标注
• 每类标注都可以在设置弹窗中单独开关

【四、搜索结果中的期刊排名】
• 在 Google Scholar 搜索论文时，每条结果的作者/发表源一行下方显示该期刊/会议的等级，例如 CCF-A、中科院-1区 Top、JCR-Q1 · IF 9.1
• 预警期刊以红色标出，一眼识别
• Scholar 截断得过短、无法确定的发表源不显示，避免误标

【五、期刊/会议与合作者】
• 发表类型分布（期刊、会议、预印本、专利等）
• 主要发表源 Top 15：篇数、引用、年份范围
• 合作者人数、多次合作者、合作论文占比、主要合作者 Top 20

【六、设置弹窗】
点击浏览器工具栏中的插件图标：
• 启用或关闭各个排名名单（关闭后不出现在统计、文章列表和搜索结果中）
• 开关一作、通讯作者标注和搜索结果排名
• 选择界面语言（中文 / English / 跟随浏览器）
设置自动保存，并立即应用到已打开的 Scholar 页面。

【七、中英文界面】
在设置弹窗或统计区域标题栏切换中文 / English，默认跟随浏览器语言。

━━━━━━━━━━━━━━━━━━━━
■ 使用方法
━━━━━━━━━━━━━━━━━━━━
1. 安装后打开任意 Google Scholar 学者主页（网址形如 scholar.google.com/citations?user=…）。
2. 插件自动加载全部论文（每次 100 篇，约每秒一次），完成后显示统计并标注文章列表。
3. 在“排名名单”页切换要查看的名单；点击工具栏中的插件图标，设置启用哪些名单、显示哪些标注。
4. 在 Google Scholar 搜索论文时，搜索结果下方会自动显示期刊/会议排名。
5. 如果学者本人署名识别不准，可在“概览”页底部手动修改（如 “J Smith”），按回车重新统计。

支持 scholar.google.com 及 .com.hk、.co.uk、.de、.co.jp、.cn 等常用国家/地区域名。

━━━━━━━━━━━━━━━━━━━━
■ 统计口径
━━━━━━━━━━━━━━━━━━━━
• 独立作者的论文计为第一作者。
• 作者名后带 * 的视为通讯作者（例如 Z Xiao*，可在 Scholar 中编辑论文作者添加）。
• Scholar 会把较长的作者列表截断为 “...”，这些论文无法判断末位作者，也不计入平均作者数。
• 期刊/会议匹配依据 Scholar 显示的发表源名称（全称、缩写、截断名称），Workshop、Findings 等附属出版物不计入；极少数写法特殊的名称可能漏匹配或误匹配。
• 如果加载过程中 Google 弹出人机验证，插件会提示，并先显示已加载部分的统计。

━━━━━━━━━━━━━━━━━━━━
■ 隐私
━━━━━━━━━━━━━━━━━━━━
• 不收集、不上传、不出售任何数据，没有统计分析或广告代码。
• 所有统计都在您的浏览器本地计算；插件只与您正在访问的 Google Scholar 网站通信。
• 只在本地保存界面语言、启用的名单、标注开关等设置。
• 只在 Google Scholar 学者主页和搜索结果页上运行，不访问其他网站；不读取、不保存您的搜索词。
隐私政策：https://github.com/zirenxiao/scholar-assistant-chrome/blob/main/PRIVACY.md

━━━━━━━━━━━━━━━━━━━━
■ 数据来源
━━━━━━━━━━━━━━━━━━━━
排名数据来自开源项目 ShowJCR（https://github.com/hitfyd/ShowJCR），其整理自 CCF、中科院文献情报中心分区表、新锐学术、国际期刊预警名单及 Clarivate JCR 等原始发布方。各排名数据的权利归原发布方所有；本插件与 Google 及上述机构均无关联。

━━━━━━━━━━━━━━━━━━━━
■ 反馈与源代码
━━━━━━━━━━━━━━━━━━━━
开源地址：https://github.com/zirenxiao/scholar-assistant-chrome
问题反馈或功能建议请提交 Issue：https://github.com/zirenxiao/scholar-assistant-chrome/issues
```

---

## English (en)

```
Scholar Assistant turns any Google Scholar profile into a full research analytics report. Open a researcher's profile and it automatically loads all of their publications, adds detailed statistics below the "Cited by" box, and marks every paper in the article list with the researcher's authorship role and the venue's ranking (CCF, JCR, CAS journal ranking, XR journal ranking, international journal early warning list). When you search for papers on Google Scholar, every search result shows its venue's rankings too.

Useful for evaluating researchers and collaborators, preparing a CV or a job, tenure or grant application, choosing a supervisor or reviewer, and seeing at a glance where someone publishes.

━━━━━━━━━━━━━━━━━━━━
■ FEATURES
━━━━━━━━━━━━━━━━━━━━

[1] Researcher statistics (below "Cited by")
• Papers and total citations, plus first-author, last-author and corresponding-author paper counts, each with its citations and h-index
• Mean and median number of authors, byline position chart
• h-index, g-index, i10-index, e-index, m-quotient, academic age, papers per year
• Mean and median citations, most cited paper, uncited papers, h-core share
• Papers and citations in the last 5 years, last year's citations and year-over-year growth
• Charts: citations per year, papers per year, papers by citation count

[2] Journal and conference rankings
Five built-in lists, matched to every paper automatically:
• CCF Recommended List 2026 (A / B / C, journals and conferences)
• CAS Journal Ranking 2025 (中科院分区, Zone 1–4, with Top and warning marks)
• JCR 2025 (Q1–Q4, with Journal Impact Factor)
• XR Journal Ranking 2026 (新锐分区, Zone 1–4, with Top and warning marks)
• International Journal Early Warning List 2025 (国际期刊预警名单)
For each list: papers per tier, their citations, first/corresponding-author counts and journal/conference split; mean impact factor for JCR. The list of ranked papers can be filtered by tier, Top or warning.

[3] Marks in the article list
• First-author and corresponding-author papers are highlighted with "1st author" / "Corresponding" badges, and the researcher's name is shown in bold
• Every paper shows a badge per matching list, e.g. CCF-A, CAS-Zone 1 Top, JCR-Q1 · IF 9.1, XR-Zone 2
• Top tiers are emphasized and warning-list journals are shown in red
• Papers loaded with "Show more" are marked automatically
• Each kind of mark can be switched on or off in the settings popup

[4] Venue rankings in search results
• When you search on Google Scholar, each result shows its venue's tier below the author/venue line, e.g. CCF-A, CAS-Zone 1 Top, JCR-Q1 · IF 9.1
• Warning-list journals are shown in red, so you can spot them at a glance
• Venue names Scholar cut too short to identify get no badge rather than a wrong one

[5] Venues and co-authors
• Publication types (journal, conference, preprint, patent, ...)
• Top 15 venues with paper counts, citations and year range
• Number of co-authors, repeat co-authors, share of co-authored papers, top 20 co-authors

[6] Settings popup
Click the extension icon in the browser toolbar to:
• enable or disable each ranking list (disabled lists are left out of the statistics, the article list and search results)
• switch first-author, corresponding-author and search-result marks on or off
• choose the language (中文 / English / same as browser)
Settings are saved automatically and apply immediately to open Scholar pages.

[7] Chinese and English interface
Switch between 中文 and English in the settings popup or the section header; defaults to your browser language.

━━━━━━━━━━━━━━━━━━━━
■ HOW TO USE
━━━━━━━━━━━━━━━━━━━━
1. Open any Google Scholar profile (scholar.google.com/citations?user=...).
2. The extension loads all publications (100 per request, about one request per second), then shows the statistics and marks the article list.
3. In the Rankings tab, choose which list to view; click the extension icon in the toolbar to choose which lists are enabled and what to mark.
4. When you search on Google Scholar, venue rankings appear under the results automatically.
5. If the researcher's own byline name is detected incorrectly, correct it at the bottom of the Overview tab (e.g. "J Smith") and press Enter.

Works on scholar.google.com and Scholar's country domains such as .co.uk, .de, .co.jp, .com.hk and .cn.

━━━━━━━━━━━━━━━━━━━━
■ HOW THINGS ARE COUNTED
━━━━━━━━━━━━━━━━━━━━
• Sole-authored papers count as first-author papers.
• A name ending in * (e.g. Z Xiao*) marks the corresponding author; you can add it by editing a paper's authors in Scholar.
• Scholar truncates long author lists with "..."; for those papers the last author cannot be determined and they are left out of team-size statistics.
• Venues are matched from the name Scholar shows (full name, abbreviation or truncated name). Workshops, Findings and other satellite venues are not counted. A few unusual venue strings may be missed or mismatched.
• If Google shows a CAPTCHA while loading, the extension says so and shows statistics for the papers loaded so far.

━━━━━━━━━━━━━━━━━━━━
■ PRIVACY
━━━━━━━━━━━━━━━━━━━━
• No data is collected, uploaded or sold, and there is no analytics or advertising code.
• All statistics are computed locally in your browser; the extension only talks to the Google Scholar site you are viewing.
• Only settings (language, enabled lists, which marks to show) are stored, locally.
• It runs only on Google Scholar profile and search result pages and accesses no other website; your search terms are not read or stored.
Privacy policy: https://github.com/zirenxiao/scholar-assistant-chrome/blob/main/PRIVACY.md

━━━━━━━━━━━━━━━━━━━━
■ DATA SOURCES
━━━━━━━━━━━━━━━━━━━━
Ranking data comes from the open-source project ShowJCR (https://github.com/hitfyd/ShowJCR), compiled from the original publishers: CCF, the CAS journal ranking (fenqubiao), XR Scholar, the international journal early warning list and Clarivate JCR. The rankings belong to their respective publishers. This extension is not affiliated with Google or any of these organizations.

━━━━━━━━━━━━━━━━━━━━
■ FEEDBACK AND SOURCE CODE
━━━━━━━━━━━━━━━━━━━━
Source code: https://github.com/zirenxiao/scholar-assistant-chrome
Bug reports and feature requests: https://github.com/zirenxiao/scholar-assistant-chrome/issues
```
