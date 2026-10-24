
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels = false;

const MODEL_ID = "onnx-community/SmolLM2-360M-ONNX";
const guardrail = `You are SisterCare Detroit, a compassionate breast-health care-navigation assistant. You are not a doctor and must never diagnose or estimate cancer risk. Encourage prompt professional evaluation for a new or concerning breast change. For severe or rapidly worsening symptoms, advise urgent medical help. Give brief, general information. Never tell a person to delay care or invent clinic details. Do not request identifying information. Be warm and concise.`;

let modelPromise;

async function getModel() {
  if (!modelPromise) {
    modelPromise = pipeline("text-generation", MODEL_ID, {
      dtype: "q4",
      progress_callback: (progress) => {
        self.postMessage({
          type: "progress",
          progress
        });
      }
    }).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

self.onmessage = async (event) => {
  const { text, id } = event.data;

  try {
    self.postMessage({ type: "status", id, text: "Loading AI model…" });

    const model = await getModel();

    self.postMessage({ type: "status", id, text: "Preparing response…" });

    const output = await model(
      `${guardrail}\n\nUser: ${text}\n\nAssistant:`,
      {
        max_new_tokens: 60,
        do_sample: false,
        repetition_penalty: 1.12,
        return_full_text: false
      }
    );

    let answer = Array.isArray(output)
      ? output[0]?.generated_text
      : output?.generated_text;

    answer = (answer || "")
      .replace(/<\|.*?\|>/g, "")
      .trim()
      .slice(0, 1000);

    self.postMessage({
      type: "answer",
      id,
      answer: answer || "For a new or concerning breast change, please contact a healthcare professional promptly."
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: "The AI could not complete this response. Please try again, or use the call script and resource links on this page."
    });
  }
};
