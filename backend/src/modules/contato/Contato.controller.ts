import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ContatoService } from './Contato.service'
import { contatoEspecialistaSchema } from './Contato.schema'

const service = new ContatoService()

// Atrás do proxy do Azure o request.ip é o do próprio proxy (todo mundo "parece" o mesmo IP),
// então o limite usa o último IP do X-Forwarded-For (o que o proxy anexou).
const ipDoCliente = (request: FastifyRequest): string => {
  const encaminhado = request.headers['x-forwarded-for']
  const lista = (Array.isArray(encaminhado) ? encaminhado.join(',') : encaminhado ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
  return lista[lista.length - 1] ?? request.ip
}

export async function contatoRoutes(app: FastifyInstance): Promise<void> {
  // POST /contato/especialista — público (vem do site, sem login)
  app.post(
    '/especialista',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '10 minutes', keyGenerator: ipDoCliente },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dados = contatoEspecialistaSchema.parse(request.body)

      // Robô preencheu o campo escondido: responde "ok" sem enviar nada
      if (dados.website) {
        return reply.status(201).send({ message: 'Recebemos seu contato.' })
      }

      await service.enviarParaEspecialista(dados)

      return reply.status(201).send({
        message: 'Recebemos seu contato! Nossa equipe fala com você em breve.',
      })
    }
  )
}
