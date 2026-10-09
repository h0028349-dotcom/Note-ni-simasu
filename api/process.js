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
授業の音声データです。この音声を聞き取って内容を解析し、生徒用ノートと穴埋めテストを作成して以下のJSON形式のみで出力してください。

【出力フォーマット (JSON)】
{
  "subject": "教科名",
  "title": "授業タイトル",
  "key_points": ["要点1", "要点2", "重要単語は <mark class='bg-red-100 text-red-700 px-1 font-bold'>重要単語</mark> のようにマークタグで囲む"],
  "teacher_advice": "先生のアドバイスやテストに出るポイント",
  "homework": {
    "task": "宿題内容",
    "due": "提出期限"
  },
  "fill_in_questions": [
    "1. 質問文章（　　　　）補足",
    "2. 質問文章（　　　　）補足"
  ]
}`;

    // 最新の標準モデル gemini-2.0-flash を指定
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
