export default function WelcomeHeader() {
  const hora = new Date().getHours()
  let saudacao = 'Bom dia'
  if (hora >= 12 && hora < 18) {
    saudacao = 'Boa tarde'
  } else if (hora >= 18 || hora < 5) {
    saudacao = 'Boa noite'
  }

  return (
    <div className="px-4 py-3 mb-4 bg-white shadow-sm rounded-2xl border border-gray-100 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#2D6A4F' }}>
          {saudacao}! 🍀
        </h2>
        <p className="text-sm text-gray-500">Que sua lista seja leve.</p>
      </div>
    </div>
  )
}
