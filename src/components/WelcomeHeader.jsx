const SABEDORIAS = [
  'Quem vai ao mercado com fome, volta com o mercado.',
  'Lista feita com calma evita carrinho com drama.',
  'O segredo da economia é não levar o que não precisa.',
  'Promoção boa é a que você já ia comprar.',
  'Mercado vazio, mente cheia. Mercado cheio, carteira vazia.',
  'Não existe "só vou pegar uma coisa".',
  'A fila do caixa é o purgatório dos indecisos.',
  'Frutas da estação: boas pro bolso, boas pro paladar.',
  'Quem confere a lista não esquece o alho.',
  'Organização no mercado é tempo na vida.',
  'Congele o que sobra, agradeça o que tem.',
  'Carnes em promoção na segunda, frutas na feira.',
  'Lista curta, compra inteligente.',
  'O impulso mora na prateleira da altura dos olhos.',
  'Cozinhar em casa é o investimento que sempre rende.',
  'Não subestime o poder de um bom planejamento.',
  'Quem planeja a semana, domina o carrinho.',
  'A melhor dieta começa na lista de compras.',
  'Mercado com pressa é receita pra esquecimento.',
  'Menos corredores, mais propósito.',
]

export default function WelcomeHeader() {
  const hora = new Date().getHours()
  let saudacao = 'Bom dia'
  if (hora >= 12 && hora < 18) {
    saudacao = 'Boa tarde'
  } else if (hora >= 18 || hora < 5) {
    saudacao = 'Boa noite'
  }

  const hoje = new Date()
  const diaDoAno = Math.floor((hoje - new Date(hoje.getFullYear(), 0, 0)) / 86400000)
  const frase = SABEDORIAS[diaDoAno % SABEDORIAS.length]

  return (
    <div
      className="px-4 py-4 mb-1 rounded-2xl"
      style={{
        backgroundColor: '#F9F6F1',
        border: '1px solid #E0D9CE',
      }}
    >
      <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#2D6A4F', letterSpacing: '0.06em' }}>
        {hora >= 18 || hora < 5 ? '🌙' : hora >= 12 ? '☀️' : '🌤️'} {saudacao}
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: '#1A1814', lineHeight: 1.25, marginBottom: '5px' }}>
        Vamos montar a lista de hoje?
      </h2>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.75rem', fontStyle: 'italic', color: '#7A7267', lineHeight: 1.4 }}>
        "{frase}"
      </p>
    </div>
  )
}
