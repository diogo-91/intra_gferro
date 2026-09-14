import { Router } from 'express';
import { obterSessao } from './auth';
import { criarRepositorioQualidade } from './qualidade';

export function criarRotasQualidade(repositorio = criarRepositorioQualidade()) {
  const rotas = Router();
  rotas.use(async (req, res, next) => {
    try {
      const sessao = await obterSessao(req);
      if (!sessao) return res.status(401).json({ error: 'Não autenticado.' });
      if (!sessao.administrador && !sessao.modulos.includes('qualidade')) return res.status(403).json({ error: 'Você não possui acesso ao módulo Qualidade.' });
      res.locals.autorQualidade = { nome: sessao.nome || sessao.email.split('@')[0], email: sessao.email };
      next();
    } catch (error) { next(error); }
  });
  rotas.get('/nao-conformidades', async (_req, res, next) => {
    try { res.json(await repositorio.listar()); } catch (error) { next(error); }
  });
  rotas.post('/nao-conformidades', async (req, res, next) => {
    try { res.status(201).json(await repositorio.criar(req.body, res.locals.autorQualidade)); } catch (error) { next(error); }
  });
  rotas.patch('/nao-conformidades/:id', async (req, res, next) => {
    try { res.json(await repositorio.atualizar(req.params.id, req.body, res.locals.autorQualidade)); } catch (error) { next(error); }
  });
  rotas.use((error: any, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
    if (!error.status) console.error('[qualidade]', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível salvar ou consultar as não conformidades. Tente novamente.' });
  });
  return rotas;
}
