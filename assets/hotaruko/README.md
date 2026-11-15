# ほたるこちゃんの素材

ユーザー提供の `Gemini_Generated_Image_t9m8jxt9m8jxt9m8.jpg` を編集対象とし、組み込み image_gen ツールで緑の背景を透過した４ポーズのシートを制作。元画像は変更していません。追加２点はキャラクターの参照として確認した添付資料で、この版のランタイムには同梱していません。

採用素材：`poses.png`。1774 × 887、RGBA PNG。CSSの４列スプライトとして使用。左から説明、やさしいお願い、案内、称賛。生成編集のため元画像と画素単位の一致は保証しません。

横の運転席は３列目をCSSで窓に表示。縦の専用SVGは真上からの帽子・肩・白手袋をコードで描いています。元の正面立ち絵を回転して使用しません。

制作プロンプト（組み込みツール、transparent_background=true）：

Use case: background-extraction. Edit target: the attached four-pose character sheet. Remove ONLY the green background including gaps between arms, antennae and wings, preserve all four characters and their exact faces, clothing, poses, wings, yellow glowing abdomen and original illustration style. Output the SAME four poses in the SAME left-to-right order, evenly spaced in four equal-width columns, full bodies with antennae and shoes entirely included, aligned to a common baseline, tight vertical composition without the large unused green bottom margin. Actual transparent background, clean alpha edges, no checkerboard, no added objects or text. This is an asset sheet for a children's app, retaining canonical Hotaruko identity.
