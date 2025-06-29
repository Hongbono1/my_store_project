// tailwind.config.js
module.exports = {
  mode: 'jit',
  purge: ['./public/**/*.html', './src/**/*.{js,jsx,ts,tsx}'],
  safelist: [
    'max-h-[1080px]',
    // 필요하다면 다른 크기도 추가
  ],
  theme: { /* … */ },
  variants: { /* … */ },
  plugins: [],
}

