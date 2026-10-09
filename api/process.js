export const config = {
  runtime: 'nodejs',
};

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY がVercelに設定されていません。' }), { status: 500 });
    }

    const incomingFormData = await request.formData();
    const audioFile = incomingFormData.get('file');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: '音声ファイルが見つかりません。' }), { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    const mimeType = audioFile.type || 'audio/mp3';

    const prompt = `
授業の音声データです。以下の【絶対制約】に従い、音声を聞き取ってドキュメント・スライド印刷に適した整理用データをJSON形式のみで出力してください。

【絶対制約】
1. 授業内で実際に発言された内容のみを使用してください。
2. 音声内で言及されていない「宿題」「課題」「提出期限」「テスト予定」などの情報は絶対に創作・推測して出力しないでください。
3. 印刷やプレゼン資料（スライド）化しやすいよう、授業内容をテーマごとの章（セクション）に分けて整理してください。

【出力フォーマット (JSON)】
{
  "subject": "教科名（明確な発言がない場合は『講義ノート』）",
  "title": "授業テーマ・タイトル",
  "sections": [
    {
      "heading": "1. セクションタイトル（例：〜の概要）",
      "points": [
        "実際の発言に基づく重要ポイント1",
        "実際の発言に基づく重要ポイント2"
      ],
      "detail": "発言内容に基づいた補足解説文章"
    }
  ],
  "fill_in_questions": [
    "1. 音声の発言内容に基づく穴埋め確認問題（　　　　）",
    "2. 音声の発言内容に基づく穴埋め確認問題（　　　　）"
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Gemini API エラー: ${errText}` }), { status: 500 });
    }

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(jsonText);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
