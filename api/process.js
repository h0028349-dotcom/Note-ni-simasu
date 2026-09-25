export const config = {
  runtime: 'nodejs',
};

export async function POST(request) {
  try {
    // Vercelの環境変数から安全にAPIキーを取得
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'サーバーにAPIキーが設定されていません。' }), { status: 500 });
    }

    // 画面から送られてきた音声ファイルを受け取る
    const incomingFormData = await request.formData();
    const audioFile = incomingFormData.get('file');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: '音声ファイルが見つかりません。' }), { status: 400 });
    }

    // 1. OpenAI Whisper API で文字起こし
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.mp3');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'ja');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: whisperFormData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      return new Response(JSON.stringify({ error: `Whisperエラー: ${errText}` }), { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const transcriptText = whisperData.text;

    // 2. OpenAI GPT-4o API で要約＆穴埋めレジュメ作成
    const prompt = `
以下の授業の文字起こしテキストから要約ノートと穴埋めテストを作成し、指定のJSON形式で出力してください。

【文字起こしデータ】
${transcriptText}

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

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      }),
    });

    if (!gptRes.ok) {
      return new Response(JSON.stringify({ error: 'ノート生成に失敗しました。' }), { status: 500 });
    }

    const gptData = await gptRes.json();
    const result = JSON.parse(gptData.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
