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
    // 送信された教科とテーマを取得（未入力の場合は補正）
    const subject = incomingFormData.get('subject') || '指定なし';
    const topic = incomingFormData.get('topic') || '指定なし';

    if (!audioFile) {
      return new Response(JSON.stringify({ error: '音声ファイルが見つかりません。' }), { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    const mimeType = audioFile.type || 'audio/mp3';

    const prompt = `
授業の音声データです。以下の【前提情報】および【フィルタリングルール】を厳格に守り、ドキュメント・スライド印刷に適した整理用データをJSON形式のみで出力してください。

【前提情報】
- 教科: ${subject}
- 授業テーマ/単元: ${topic}

【フィルタリングルール（雑談の排除）】
1. 上記の「教科」および「授業テーマ」に直接関係のない雑談（先生の個人談、世間話、挨拶、脱線した話題、出欠確認など）は**全てカット**し、一切出力に含めないでください。
2. 音声内で実際に発言された本質的な学習・講義内容のみを抽出してください。
3. 音声内で言及されていない「宿題」「課題」「提出期限」などの情報は絶対に創作・推測して出力しないでください。

【出力フォーマット (JSON)】
{
  "subject": "${subject !== '指定なし' ? subject : '講義ノート'}",
  "title": "${topic !== '指定なし' ? topic : '授業まとめ'}",
  "sections": [
    {
      "heading": "1. セクションタイトル",
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
