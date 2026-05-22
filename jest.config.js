module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.test.json',
            isolatedModules: true,
        },
    },
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^cannon$': '<rootDir>/src/lib/cannon/cannon.js',
        '^three/examples/jsm/(.*)$': '<rootDir>/src/ts/__mocks__/three-jsm.js',
        '^../../lib/utils/Detector$': '<rootDir>/src/ts/__mocks__/Detector.js',
        '^../../lib/utils/Stats$': '<rootDir>/src/ts/__mocks__/Stats.js',
        '^../../lib/utils/dat\\.gui$': '<rootDir>/src/ts/__mocks__/dat.gui.js',
        '^../../lib/cannon/CannonDebugRenderer$': '<rootDir>/src/ts/__mocks__/CannonDebugRenderer.js',
        'sweetalert2': '<rootDir>/src/ts/__mocks__/sweetalert2.js',
    },
};
