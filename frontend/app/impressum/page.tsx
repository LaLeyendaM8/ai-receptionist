export default function ImpressumPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-sm text-gray-700">
      <h1 className="text-2xl font-semibold mb-6">Impressum</h1>

      <p className="mb-2 font-medium">ReceptaAI</p>

      <p className="mb-2">
        Inhaber:<br />
        Michael F. E. Eraso Horn
      </p>

      <p className="mb-2">
        Adresse:<br />
        Hafnerweg 19<br />
        89231 Neu-Ulm<br />
        Deutschland
      </p>

      <p className="mb-2">
        Telefon:<br />
        +49 177 1572418
      </p>

      <p className="mb-2">
        E-Mail:<br />
        <a
          href="mailto:info@receptaai.de"
          className="text-blue-600 underline"
        >
          info@receptaai.de
        </a>
      </p>
    </main>
  );
}
