import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import ollama from 'ollama'
import fs from 'fs/promises'
import path from 'path'

const app = new Hono()

app.use('/*', cors({
    origin: 'http://localhost:5173', // Adjust this to your frontend's origin
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
}))


const historyFile = path.join(__dirname, 'message_history.json')

// Define MessageHistory type
type Role = 'system' | 'user' | 'assistant'

interface Message {
    role: Role
    content: string
}

type MessageHistory = Message[]

// Function to read message history from JSON file
async function readMessageHistory(): Promise<MessageHistory> {
    try {
        const data = await fs.readFile(historyFile, 'utf8')
        return JSON.parse(data) as MessageHistory
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // If file doesn't exist, return default history
            return [{
                role: 'system',
                content: "You're a Turkish speaking assistant! Please write your responses in Turkish."
            }]
        }
        throw error
    }
}

// Function to write message history to JSON file
async function writeMessageHistory(history: MessageHistory): Promise<void> {
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8')
}

app.get('/', (c) => {
    return c.text('Hello Hono!')
})

app.get('/message-history', async (c) => {

    const messageHistory = await readMessageHistory();

    return c.json(messageHistory)
})

app.post('/generate', async (c) => {
    const messageHistory = await readMessageHistory()
    const body = await c.req.json()
    const prompt = body.prompt as string

    messageHistory.push({ role: 'user', content: prompt })

    const response = await ollama.chat({
        model: 'gemma2:latest', // siz lutfen gemma2:2b modelini kullanin
        messages: messageHistory,
    })

    messageHistory.push({ role: 'assistant', content: response.message.content })

    // Save updated message history to JSON file
    await writeMessageHistory(messageHistory)

    console.log(messageHistory)

    return c.json({ message: response.message.content })
})

const port = 3002
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})