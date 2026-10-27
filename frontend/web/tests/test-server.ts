import { setupServer } from 'msw/node'

export const API_ORIGIN = 'http://localhost'
export const server = setupServer()
