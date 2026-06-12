/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/authRoutes.js'
import presaleRoutes from './routes/presaleRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import arrivalRoutes from './routes/arrivalRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * Serve static files in production
 */
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
}

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/presales', presaleRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/arrivals', arrivalRoutes)
app.use('/api/notifications', notificationRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && !req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, '../dist/index.html')
    res.sendFile(indexPath)
  } else {
    res.status(404).json({
      success: false,
      error: 'API not found',
    })
  }
})

export default app
