// Proteção simples por senha compartilhada — só entra em vigor se
// APP_PASSWORD estiver configurada (em produção). Sem essa variável (dev
// local), não bloqueia nada, pra não atrapalhar o dia a dia.
function requireAuth(req, res, next) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return next();

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token !== expected) {
    return res.status(401).json({ error: 'Senha incorreta ou não informada' });
  }
  next();
}

module.exports = requireAuth;
