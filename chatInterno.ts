import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const ARQUIVO = path.join(process.cwd(), 'data', 'chat-mensagens.json');
export const PASTA_ANEXOS_CHAT = path.join(process.cwd(), 'data', 'uploads', 'chat');
const CANAIS_VALIDOS = new Set([
  'chn-geral',
  'chn-dep-com',
  'chn-dep-rh',
  'chn-dep-sac',
  'chn-dep-pcp',
  'chn-dep-producao',
  'chn-dep-tecnologia',
]);
const LIMITE_MENSAGENS = 5000;

export interface MensagemChatInterno {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  criadoEm: string;
  channelId?: string;
  receiverId?: string;
  attachments?: AnexoChat[];
}

export interface AnexoChat {
  name: string;
  url: string;
  size: string;
  mimeType: string;
}

let cache: MensagemChatInterno[] | null = null;
let filaPersistencia = Promise.resolve();

async function carregar() {
  if (cache) return cache;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    cache = Array.isArray(dados) ? dados : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persistir(mensagens: MensagemChatInterno[]) {
  cache = mensagens.slice(-LIMITE_MENSAGENS);
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(cache, null, 2), 'utf-8');
}

export async function listarMensagensChat(email: string) {
  const normalizado = email.trim().toLowerCase();
  return (await carregar()).filter((mensagem) =>
    !!mensagem.channelId || mensagem.senderId === normalizado || mensagem.receiverId === normalizado
  );
}

export async function enviarMensagemChat(
  dados: { content: unknown; channelId?: unknown; receiverId?: unknown; attachment?: AnexoChat },
  autor: { email: string; nome: string },
  destinatariosValidos: Set<string>
) {
  const content = typeof dados.content === 'string' ? dados.content.trim() : '';
  if (!content && !dados.attachment) throw Object.assign(new Error('Digite uma mensagem ou selecione um anexo.'), { status: 400 });
  if (content.length > 4000) throw Object.assign(new Error('A mensagem deve ter no máximo 4.000 caracteres.'), { status: 400 });

  const channelId = typeof dados.channelId === 'string' ? dados.channelId : undefined;
  const receiverId = typeof dados.receiverId === 'string' ? dados.receiverId.trim().toLowerCase() : undefined;
  if (!!channelId === !!receiverId) {
    throw Object.assign(new Error('Informe um canal ou um destinatário.'), { status: 400 });
  }
  if (channelId && !CANAIS_VALIDOS.has(channelId)) {
    throw Object.assign(new Error('Canal desconhecido.'), { status: 400 });
  }
  if (receiverId && (!destinatariosValidos.has(receiverId) || receiverId === autor.email)) {
    throw Object.assign(new Error('Destinatário inválido.'), { status: 400 });
  }

  const mensagem: MensagemChatInterno = {
    id: randomUUID(),
    senderId: autor.email,
    senderName: autor.nome,
    content,
    criadoEm: new Date().toISOString(),
    ...(channelId ? { channelId } : { receiverId }),
    ...(dados.attachment ? { attachments: [dados.attachment] } : {}),
  };
  const operacao = filaPersistencia.then(async () => {
    const mensagens = await carregar();
    await persistir([...mensagens, mensagem]);
    return mensagem;
  });
  filaPersistencia = operacao.then(() => undefined, () => undefined);
  return operacao;
}
