// Test setup file
const winston = require('winston');

// Mock console logs during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_task_queue';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Mock PostgreSQL pool
jest.mock('pg', () => {
  const Client = require('pg').Client;
  return {
    Pool: jest.fn(() => ({
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    })),
    Client
  };
});

// Mock file system
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    chmod: jest.fn()
  }
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));