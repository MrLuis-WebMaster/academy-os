/** Shared outbound HTTP adapter for structured OpenAI responses. Never imported by domain/application. */
export async function requestStructuredOpenAi(input:{
  apiKey:string;model:string;instructions:string;input:unknown;
  schema:Record<string,unknown>;schemaName:string;maxOutputTokens:number;
}):Promise<unknown>{
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(30000),
    headers:{Authorization:'Bearer '+input.apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:input.model,store:false,max_output_tokens:input.maxOutputTokens,
      instructions:input.instructions,
      input:JSON.stringify(input.input),
      text:{format:{type:'json_schema',name:input.schemaName,strict:true,schema:input.schema}},
    }),
  });
  if(!response.ok)throw new Error('AI service returned HTTP '+response.status);
  const payload=await response.json() as {
    status?:string;output?:Array<{type:string;content?:Array<{type:string;text?:string}>}>;
  };
  if(payload.status!=='completed')throw new Error('AI generation was not completed');
  const text=payload.output?.flatMap(x=>x.content??[]).find(x=>x.type==='output_text')?.text;
  if(!text)throw new Error('AI service returned no structured response');
  try {return JSON.parse(text) as unknown;}
  catch{throw new Error('AI service returned invalid structured JSON');}
}
