import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { initialDepartments } from './src/data/departamentos';
import { PRIORIDADES_NC, STATUS_NC, type NaoConformidade, type RegistroNC } from './src/data/qualidade';

type Autor = { nome: string; email: string };
const falha = (mensagem: string, status = 400) => Object.assign(new Error(mensagem), { status });

function texto(valor: unknown, campo: string, limite = 5000, obrigatorio = false): string {
  if (valor !== undefined && typeof valor !== 'string') throw falha(`${campo} inválido.`);
  const resultado = (valor as string | undefined)?.trim() ?? '';
  if (obrigatorio && !resultado) throw falha(`Preencha ${campo.toLocaleLowerCase('pt-BR')}.`);
  if (resultado.length > limite) throw falha(`${campo} deve ter até ${limite} caracteres.`);
  return resultado;
}

function departamento(valor: unknown): string {
  if (!initialDepartments.some((item) => item.id === valor)) throw falha('Selecione um departamento válido.');
  return valor as string;
}

function prazoValido(valor: unknown): string {
  const prazo = texto(valor, 'Prazo', 10);
  if (prazo) {
    const data = new Date(`${prazo}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== prazo) {
      throw falha('Informe um prazo válido.');
    }
  }
  return prazo;
}

function evento(descricao: string, autor: Autor): RegistroNC {
  return { id: randomUUID(), descricao, autorNome: autor.nome, autorEmail: autor.email, criadoEm: new Date().toISOString() };
}

// Uma fila envolve a leitura e a gravação: aberturas simultâneas não perdem registros.
export function criarRepositorioQualidade(arquivo = path.join(process.cwd(), 'data', 'qualidade-nao-conformidades.json')) {
  let fila: Promise<unknown> = Promise.resolve();
  async function carregar(): Promise<NaoConformidade[]> {
    try {
      const dados = JSON.parse(await readFile(arquivo, 'utf-8'));
      if (!Array.isArray(dados)) throw new Error('Arquivo de não conformidades inválido.');
      return dados;
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  function alterar<T>(operacao: (registros: NaoConformidade[]) => T): Promise<T> {
    const tarefa = fila.then(async () => {
      const registros = await carregar();
      const resultado = operacao(registros);
      await mkdir(path.dirname(arquivo), { recursive: true });
      const temporario = `${arquivo}.${randomUUID()}.tmp`;
      await writeFile(temporario, JSON.stringify(registros, null, 2), 'utf-8');
      await rename(temporario, arquivo);
      return resultado;
    });
    fila = tarefa.catch(() => undefined);
    return tarefa;
  }
  return {
    async listar() {
      await fila;
      return (await carregar()).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    },
    criar(dados: Record<string, unknown>, autor: Autor) {
      return alterar((registros) => {
        if (!dados || !PRIORIDADES_NC.includes(dados.prioridade as any)) throw falha('Selecione uma prioridade válida.');
        const agora = new Date().toISOString();
        const prefixo = `NC-${new Date().getFullYear()}-`;
        const sequencia = registros.reduce((maior, nc) => nc.protocolo.startsWith(prefixo) ? Math.max(maior, Number(nc.protocolo.slice(prefixo.length)) || 0) : maior, 0) + 1;
        const nc: NaoConformidade = {
          id: randomUUID(), protocolo: `${prefixo}${String(sequencia).padStart(5, '0')}`,
          titulo: texto(dados.titulo, 'Título', 180, true),
          departamentoOrigemId: departamento(dados.departamentoOrigemId),
          departamentoResponsavelId: departamento(dados.departamentoResponsavelId),
          descricao: texto(dados.descricao, 'Descrição', 5000, true),
          evidencia: texto(dados.evidencia, 'Evidência'),
          prioridade: dados.prioridade as NaoConformidade['prioridade'], status: 'Aberta',
          responsavel: texto(dados.responsavel, 'Responsável', 120), prazo: prazoValido(dados.prazo),
          causa: '', acaoCorretiva: '', verificacao: '',
          criadoPor: autor.nome, criadoPorEmail: autor.email, criadoEm: agora, atualizadoEm: agora,
          versao: 1, historico: [evento('Não conformidade aberta.', autor)],
        };
        registros.push(nc);
        return nc;
      });
    },
    atualizar(id: string, dados: Record<string, unknown>, autor: Autor) {
      return alterar((registros) => {
        const indice = registros.findIndex((nc) => nc.id === id);
        if (indice < 0) throw falha('Não conformidade não encontrada.', 404);
        const atual = registros[indice];
        if (!dados || dados.versao !== atual.versao) throw falha('Esta não conformidade foi atualizada por outra pessoa. Reabra o registro para carregar a versão atual.', 409);
        const nova = { ...atual, historico: [...atual.historico] };
        const mudancas: string[] = [];
        if (dados.status !== undefined) {
          if (!STATUS_NC.includes(dados.status as any)) throw falha('Status inválido.');
          nova.status = dados.status as NaoConformidade['status'];
        }
        if (dados.prioridade !== undefined) {
          if (!PRIORIDADES_NC.includes(dados.prioridade as any)) throw falha('Prioridade inválida.');
          nova.prioridade = dados.prioridade as NaoConformidade['prioridade'];
        }
        if (dados.departamentoResponsavelId !== undefined) nova.departamentoResponsavelId = departamento(dados.departamentoResponsavelId);
        if (dados.prazo !== undefined) nova.prazo = prazoValido(dados.prazo);
        for (const [campo, rotulo, limite] of [
          ['responsavel', 'Responsável', 120], ['causa', 'Causa', 5000],
          ['acaoCorretiva', 'Ação corretiva', 5000], ['verificacao', 'Verificação do resultado', 5000],
        ] as const) {
          if (dados[campo] !== undefined) nova[campo] = texto(dados[campo], rotulo, limite);
        }
        const comentario = texto(dados.comentario, 'Comentário');
        if (nova.status === 'Concluída' && (!nova.responsavel || !nova.causa || !nova.acaoCorretiva || !nova.verificacao)) {
          throw falha('Para concluir, informe responsável, causa, ação corretiva e verificação do resultado.');
        }
        if (nova.status === 'Cancelada' && atual.status !== 'Cancelada' && !comentario) throw falha('Informe o motivo do cancelamento no comentário.');
        for (const [campo, rotulo] of [
          ['status', 'Status'], ['prioridade', 'Prioridade'], ['departamentoResponsavelId', 'Departamento responsável'],
          ['responsavel', 'Responsável'], ['prazo', 'Prazo'], ['causa', 'Causa'],
          ['acaoCorretiva', 'Ação corretiva'], ['verificacao', 'Verificação do resultado'],
        ] as const) {
          if (nova[campo] !== atual[campo]) {
            const nome = (valor: string) => campo === 'departamentoResponsavelId' ? initialDepartments.find((dep) => dep.id === valor)?.name ?? valor : valor;
            mudancas.push(`${rotulo}: ${nome(atual[campo]) || 'Não informado'} → ${nome(nova[campo]) || 'Não informado'}`);
          }
        }
        if (!mudancas.length && !comentario) return atual;
        const agora = new Date().toISOString();
        nova.atualizadoEm = agora;
        nova.versao += 1;
        nova.concluidoEm = nova.status === 'Concluída' ? atual.concluidoEm ?? agora : undefined;
        nova.historico.push(...mudancas.map((descricao) => evento(descricao, autor)));
        if (comentario) nova.historico.push(evento(comentario, autor));
        registros[indice] = nova;
        return nova;
      });
    },
  };
}
