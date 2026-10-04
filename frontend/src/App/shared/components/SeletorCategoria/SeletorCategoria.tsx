import React from 'react'
import ContadorCaracteres from '../ContadorCaracteres/ContadorCaracteres'
import {
  GRUPOS_CATEGORIAS_PADRAO,
  OUTRA_CATEGORIA,
  SelecaoCategoria,
  chaveDeNome,
} from '../../constants/categoriasPadrao'

interface SeletorCategoriaProps {
  id: string
  valor: SelecaoCategoria
  onChange: (valor: SelecaoCategoria) => void
  /** Nomes que o restaurante já tem: ficam desabilitados na lista (evita duplicar) */
  jaUsadas?: string[]
  desabilitado?: boolean
  /** Classes do projeto onde o seletor é usado (o componente não traz CSS próprio) */
  selectClassName?: string
  inputClassName?: string
  /** Enter no campo "Outra" */
  onEnter?: () => void
  autoFocus?: boolean
}

/**
 * Lista de categorias prontas + "Outra" com texto livre.
 * Mesmo padrão do "Tipo de cozinha" em Configurações.
 */
const SeletorCategoria: React.FC<SeletorCategoriaProps> = ({
  id,
  valor,
  onChange,
  jaUsadas = [],
  desabilitado = false,
  selectClassName,
  inputClassName,
  onEnter,
  autoFocus,
}) => {
  const usadas = new Set(jaUsadas.map(chaveDeNome))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <select
        id={id}
        className={selectClassName}
        value={valor.selecao}
        disabled={desabilitado}
        autoFocus={autoFocus}
        onChange={(e) => onChange({ selecao: e.target.value, texto: valor.texto })}
        style={{ cursor: 'pointer' }}
      >
        <option value="">Escolha uma categoria</option>

        {GRUPOS_CATEGORIAS_PADRAO.map((g) => (
          <optgroup key={g.grupo} label={g.grupo}>
            {g.itens.map((c) => {
              const jaTem = usadas.has(chaveDeNome(c.nome))
              return (
                <option key={c.nome} value={c.nome} disabled={jaTem}>
                  {c.icone} {c.nome}
                  {jaTem ? ' (já criada)' : ''}
                </option>
              )
            })}
          </optgroup>
        ))}

        <option value={OUTRA_CATEGORIA}>Outra (digitar)</option>
      </select>

      {valor.selecao === OUTRA_CATEGORIA && (
        <>
        <input
          id={`${id}-outra`}
          className={inputClassName}
          placeholder="Digite o nome da categoria"
          maxLength={100}
          value={valor.texto}
          disabled={desabilitado}
          autoFocus
          onChange={(e) => onChange({ selecao: valor.selecao, texto: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault()
              onEnter()
            }
          }}
        />
        <ContadorCaracteres valor={valor.texto} max={100} />
        </>
      )}
    </div>
  )
}

export default SeletorCategoria
