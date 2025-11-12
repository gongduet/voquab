export default function StyleTest() {
  console.log('🎨 StyleTest component loaded')

  return (
    <div>
      {/* Test with inline styles first */}
      <div style={{
        backgroundColor: 'red',
        color: 'white',
        padding: '20px',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        INLINE STYLES: If you see red background, inline styles work
      </div>

      {/* Test with Tailwind classes */}
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-8">
        <div className="bg-red-500 text-white p-8 text-4xl font-bold rounded-lg shadow-2xl">
          TAILWIND: If you see red background, Tailwind works!
        </div>

        <div className="absolute top-8 left-8 bg-blue-500 text-white p-4 rounded-lg">
          <p className="text-xl font-bold">Blue Box Test</p>
        </div>

        <div className="absolute bottom-8 right-8 bg-green-500 text-white p-4 rounded-lg">
          <p className="text-xl font-bold">Green Box Test</p>
        </div>
      </div>
    </div>
  )
}
