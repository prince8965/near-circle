import { spawnSync } from 'node:child_process'

console.log('=================================================================')
console.log('           NearCircle: Executing All Automated Test Suites        ')
console.log('=================================================================\n')

console.log('>> [1/4] Running Phase 6 Test Suite...')
const res6 = spawnSync('npx', ['vite-node', 'scripts/test-phase6.ts'], {
  stdio: 'inherit',
  shell: true,
})

if (res6.status !== 0) {
  console.error('\n✗ Phase 6 tests failed!')
  process.exit(res6.status ?? 1)
}

console.log('\n>> [2/4] Running Phase 7 Test Suite...')
const res7 = spawnSync('npx', ['vite-node', 'scripts/test-phase7.ts'], {
  stdio: 'inherit',
  shell: true,
})

if (res7.status !== 0) {
  console.error('\n✗ Phase 7 tests failed!')
  process.exit(res7.status ?? 1)
}

console.log('\n>> [3/4] Running Phase 8 & 9 Test Suite...')
const res89 = spawnSync('npx', ['vite-node', 'scripts/test-phase8-9.ts'], {
  stdio: 'inherit',
  shell: true,
})

if (res89.status !== 0) {
  console.error('\n✗ Phase 8 & 9 tests failed!')
  process.exit(res89.status ?? 1)
}

console.log('\n>> [4/4] Running Phase 10 Test Suite...')
const res10 = spawnSync('npx', ['vite-node', 'scripts/test-phase10.ts'], {
  stdio: 'inherit',
  shell: true,
})

if (res10.status !== 0) {
  console.error('\n✗ Phase 10 tests failed!')
  process.exit(res10.status ?? 1)
}

console.log('\n=================================================================')
console.log(' All Test Suites Passed Successfully (Phases 6, 7, 8, 9 & 10: 100%) ')
console.log('=================================================================\n')
