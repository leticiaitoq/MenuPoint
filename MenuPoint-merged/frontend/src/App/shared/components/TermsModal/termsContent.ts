export interface TermsSection {
  id: string;
  titulo: string;
  paragrafos: string[];
}

export interface TermsContent {
  tituloDocumento: string;
  ultimaAtualizacao: string;
  introducao: string;
  secoes: TermsSection[];
  rodape: string;
}

export const termsContent: TermsContent = {
  tituloDocumento: 'Termos de Uso e Política de Privacidade',
  ultimaAtualizacao: '22 de agosto de 2026',
  introducao:
    'Bem-vindo ao MenuPoint. Estes Termos de Uso estabelecem as regras, direitos, deveres e ' +
    'responsabilidades relacionados ao acesso e à utilização da plataforma MenuPoint, incluindo ' +
    'seu sistema de cardápio digital, funcionalidades destinadas a restaurantes e clientes, ' +
    'gerenciamento de pedidos, mesas, produtos, pagamentos e demais serviços disponibilizados ' +
    'pela plataforma.',
  secoes: [
    {
      id: 'aceitacao',
      titulo: '1. Aceitação dos Termos',
      paragrafos: [
        'Ao acessar, cadastrar-se ou utilizar o MenuPoint, o usuário declara que leu, compreendeu ' +
          'e concorda com estes Termos de Uso e com a Política de Privacidade da plataforma. Caso ' +
          'não concorde com qualquer uma das condições apresentadas, o usuário deverá interromper ' +
          'a utilização do sistema.',
      ],
    },
    {
      id: 'sobre-a-plataforma',
      titulo: '2. Sobre a Plataforma',
      paragrafos: [
        'O MenuPoint é uma plataforma tecnológica destinada a facilitar a interação entre ' +
          'restaurantes e seus clientes. Por meio do sistema, os restaurantes podem disponibilizar ' +
          'seus cardápios digitais, cadastrar produtos, receber pedidos, gerenciar mesas, acompanhar ' +
          'vendas e utilizar outras ferramentas de gerenciamento disponibilizadas pela plataforma.',
      ],
    },
    {
      id: 'uso-adequado',
      titulo: '3. Uso Adequado da Plataforma',
      paragrafos: [
        'O usuário é responsável por utilizar o MenuPoint de maneira correta, ética e de acordo ' +
          'com a legislação brasileira. É proibida a utilização da plataforma para atividades ' +
          'ilegais, fraudulentas, ofensivas ou que possam prejudicar o funcionamento do sistema, ' +
          'outros usuários, restaurantes ou terceiros.',
      ],
    },
    {
      id: 'cadastro-e-seguranca',
      titulo: '4. Cadastro e Segurança da Conta',
      paragrafos: [
        'Para utilizar determinadas funcionalidades, poderá ser necessário realizar um cadastro. ' +
          'O usuário deverá fornecer informações verdadeiras, completas e atualizadas. O ' +
          'fornecimento de informações falsas, incompletas ou pertencentes a terceiros poderá ' +
          'resultar na suspensão ou encerramento da conta.',
        'O usuário é responsável pela segurança de seus dados de acesso, incluindo senha, e-mail ' +
          'e demais informações utilizadas para autenticação. O usuário não deverá compartilhar ' +
          'suas credenciais com terceiros e deverá comunicar imediatamente ao MenuPoint qualquer ' +
          'suspeita de acesso não autorizado à sua conta.',
      ],
    },
    {
      id: 'responsabilidades-restaurante',
      titulo: '5. Responsabilidades do Restaurante',
      paragrafos: [
        'Os restaurantes são responsáveis pelas informações disponibilizadas em seus cardápios, ' +
          'incluindo nomes dos produtos, descrições, imagens, ingredientes, preços, adicionais, ' +
          'tamanhos, disponibilidade, promoções e demais características. O restaurante também é ' +
          'responsável pela atualização dessas informações e pela veracidade dos dados apresentados ' +
          'aos clientes.',
        'Os produtos e serviços apresentados no MenuPoint são fornecidos pelos respectivos ' +
          'restaurantes. O MenuPoint atua como uma plataforma tecnológica de intermediação e ' +
          'disponibilização de ferramentas digitais e não é necessariamente responsável pela ' +
          'produção, preparação, qualidade, composição, embalagem ou entrega dos alimentos ' +
          'comercializados pelos estabelecimentos.',
      ],
    },
    {
      id: 'pedidos-e-precos',
      titulo: '6. Pedidos e Preços',
      paragrafos: [
        'Antes de realizar um pedido, o cliente deverá conferir atentamente os produtos ' +
          'selecionados, quantidades, adicionais, observações, valores, taxas e demais informações ' +
          'apresentadas. Após a confirmação, o pedido poderá ser encaminhado ao restaurante para ' +
          'processamento.',
        'A aceitação de um pedido dependerá da disponibilidade dos produtos e das condições ' +
          'operacionais do restaurante. O estabelecimento poderá recusar ou cancelar pedidos em ' +
          'situações como indisponibilidade de produtos, encerramento do atendimento, problemas ' +
          'operacionais, informações incorretas ou outras circunstâncias justificáveis.',
        'Os preços apresentados no sistema são definidos pelos respectivos restaurantes e poderão ' +
          'ser alterados pelos estabelecimentos a qualquer momento. Alterações posteriores não ' +
          'deverão afetar pedidos que já tenham sido devidamente confirmados, salvo situações ' +
          'previstas pela legislação ou pelas condições específicas da compra.',
      ],
    },
    {
      id: 'pagamentos',
      titulo: '7. Pagamentos, Cancelamentos e Reembolsos',
      paragrafos: [
        'Quando houver pagamento realizado por meio da plataforma ou por serviços integrados ao ' +
          'MenuPoint, o processamento poderá ser realizado por empresas especializadas, instituições ' +
          'financeiras, operadoras de cartão ou outros prestadores de serviços de pagamento. O ' +
          'MenuPoint não se responsabiliza por falhas exclusivamente relacionadas aos sistemas ' +
          'desses terceiros.',
        'As condições de cancelamento, reembolso e estorno poderão variar de acordo com o ' +
          'restaurante, o tipo de pedido, o estágio de preparação e o meio de pagamento utilizado. ' +
          'Quando aplicável, o prazo para realização de estornos poderá depender da instituição ' +
          'financeira ou empresa responsável pelo processamento do pagamento.',
      ],
    },
    {
      id: 'obrigacoes-legais',
      titulo: '8. Obrigações Legais dos Restaurantes',
      paragrafos: [
        'Os restaurantes que utilizarem o MenuPoint são responsáveis pelo cumprimento da ' +
          'legislação aplicável às suas atividades, incluindo normas relacionadas à defesa do ' +
          'consumidor, segurança alimentar, informações sobre produtos, tributos, direitos ' +
          'trabalhistas e demais obrigações legais pertinentes ao funcionamento do estabelecimento.',
        'O restaurante também deverá garantir que possui autorização para utilizar imagens, ' +
          'marcas, fotografias, textos, logotipos e demais conteúdos inseridos em seu cardápio ou ' +
          'em qualquer outra área da plataforma.',
      ],
    },
    {
      id: 'responsabilidades-cliente',
      titulo: '9. Responsabilidades do Cliente',
      paragrafos: [
        'O cliente é responsável por fornecer corretamente as informações necessárias para a ' +
          'realização de pedidos e pela conferência dos dados antes da confirmação. O uso de dados ' +
          'falsos, pedidos fraudulentos, tentativas de obtenção de vantagens indevidas ou qualquer ' +
          'outra forma de utilização abusiva da plataforma poderá resultar na suspensão ou ' +
          'encerramento da conta.',
      ],
    },
    {
      id: 'privacidade-lgpd',
      titulo: '10. Privacidade e Proteção de Dados (LGPD)',
      paragrafos: [
        'O MenuPoint poderá utilizar informações fornecidas pelos usuários para permitir o ' +
          'funcionamento da plataforma, processar pedidos, realizar autenticação, oferecer suporte, ' +
          'melhorar os serviços, prevenir fraudes, cumprir obrigações legais e exercer direitos ' +
          'legítimos, sempre observando a legislação aplicável.',
        'O tratamento de dados pessoais realizado pelo MenuPoint deverá observar a Lei Geral de ' +
          'Proteção de Dados Pessoais, Lei nº 13.709/2018, bem como outras normas aplicáveis à ' +
          'proteção de dados e à privacidade. As informações detalhadas sobre coleta, utilização, ' +
          'armazenamento, compartilhamento e proteção dos dados pessoais estão disponíveis na ' +
          'Política de Privacidade do MenuPoint.',
        'O MenuPoint poderá utilizar cookies e tecnologias semelhantes para garantir o ' +
          'funcionamento adequado da plataforma, armazenar preferências, melhorar a experiência do ' +
          'usuário, gerar estatísticas e disponibilizar determinadas funcionalidades.',
        'O MenuPoint poderá enviar comunicações relacionadas ao funcionamento da conta, pedidos, ' +
          'segurança, atualizações, suporte, alterações importantes no serviço e, quando permitido, ' +
          'informações promocionais.',
      ],
    },
    {
      id: 'promocoes',
      titulo: '11. Promoções e Descontos',
      paragrafos: [
        'A plataforma poderá apresentar promoções, cupons e descontos disponibilizados pelo ' +
          'próprio MenuPoint ou pelos restaurantes. Cada promoção poderá possuir regras específicas, ' +
          'incluindo prazo de validade, quantidade disponível, produtos participantes, valor mínimo ' +
          'de compra e outras condições.',
      ],
    },
    {
      id: 'disponibilidade-do-servico',
      titulo: '12. Disponibilidade e Alterações do Serviço',
      paragrafos: [
        'O MenuPoint buscará manter seus sistemas disponíveis e funcionando adequadamente, porém ' +
          'não garante que a plataforma permanecerá permanentemente livre de erros, interrupções ou ' +
          'indisponibilidades. O sistema poderá ficar temporariamente indisponível em razão de ' +
          'manutenções, atualizações, falhas técnicas, problemas de infraestrutura, falhas de ' +
          'serviços de terceiros, ataques virtuais, eventos de força maior ou outras situações fora ' +
          'do controle razoável da plataforma.',
        'O MenuPoint poderá realizar alterações, atualizações, melhorias, substituições ou ' +
          'descontinuações de funcionalidades sempre que necessário para o aprimoramento da ' +
          'plataforma, adequação às necessidades dos usuários, segurança do sistema ou cumprimento ' +
          'de obrigações legais.',
      ],
    },
    {
      id: 'propriedade-intelectual',
      titulo: '13. Propriedade Intelectual',
      paragrafos: [
        'Todo o conteúdo pertencente ao MenuPoint, incluindo sua marca, logotipo, identidade ' +
          'visual, código-fonte, interfaces, layout, textos, sistemas, funcionalidades e elementos ' +
          'gráficos, é protegido pela legislação aplicável de propriedade intelectual. O uso da ' +
          'plataforma não concede ao usuário qualquer direito de propriedade sobre esses elementos.',
        'É proibida a reprodução, cópia, distribuição, alteração, engenharia reversa, ' +
          'comercialização ou utilização não autorizada de qualquer parte do sistema MenuPoint.',
        'Os conteúdos inseridos pelos restaurantes permanecem sob responsabilidade de seus ' +
          'respectivos titulares. Ao inserir imagens, textos, logotipos, descrições ou outros ' +
          'materiais na plataforma, o restaurante declara possuir os direitos necessários para sua ' +
          'utilização e autoriza o MenuPoint a armazenar, processar e exibir esses conteúdos para a ' +
          'execução dos serviços disponibilizados.',
      ],
    },
    {
      id: 'seguranca-e-responsabilidade',
      titulo: '14. Segurança e Limitação de Responsabilidade',
      paragrafos: [
        'O MenuPoint poderá adotar medidas técnicas e administrativas destinadas a proteger as ' +
          'informações tratadas pela plataforma contra acessos não autorizados, perda, alteração, ' +
          'divulgação ou destruição indevida. Entretanto, nenhum sistema eletrônico é completamente ' +
          'imune a falhas, ataques ou incidentes de segurança.',
        'O MenuPoint não será responsável por problemas decorrentes exclusivamente de informações ' +
          'incorretas fornecidas pelos usuários ou restaurantes, indisponibilidade de produtos, ' +
          'atrasos causados pelos estabelecimentos ou terceiros, qualidade dos alimentos, preparação ' +
          'dos pedidos ou outras circunstâncias que estejam fora do controle razoável da plataforma, ' +
          'respeitados os direitos garantidos pela legislação brasileira.',
      ],
    },
    {
      id: 'suspensao-e-encerramento',
      titulo: '15. Suspensão e Encerramento de Conta',
      paragrafos: [
        'O MenuPoint poderá suspender ou encerrar contas que apresentem comportamento fraudulento, ' +
          'violem estes Termos de Uso, descumpram a legislação aplicável ou prejudiquem o ' +
          'funcionamento da plataforma e seus usuários.',
        'O usuário poderá solicitar o encerramento de sua conta por meio dos canais oficiais ' +
          'disponibilizados pelo MenuPoint. O encerramento da conta não necessariamente resultará na ' +
          'exclusão imediata de todas as informações relacionadas ao usuário, especialmente quando ' +
          'determinados dados precisarem ser mantidos para cumprimento de obrigações legais, ' +
          'prevenção de fraudes, segurança, auditoria ou exercício regular de direitos.',
      ],
    },
    {
      id: 'servicos-de-terceiros',
      titulo: '16. Serviços de Terceiros',
      paragrafos: [
        'A plataforma poderá disponibilizar links, integrações ou serviços de empresas terceiras. ' +
          'Esses serviços poderão possuir seus próprios termos de uso e políticas de privacidade, ' +
          'sendo de responsabilidade do usuário verificar as condições aplicáveis ao utilizar ' +
          'serviços externos.',
      ],
    },
    {
      id: 'comunicacoes',
      titulo: '17. Comunicações',
      paragrafos: [
        'O MenuPoint poderá entrar em contato com os usuários por meio dos dados fornecidos ' +
          'durante o cadastro. O usuário deverá manter suas informações de contato atualizadas para ' +
          'garantir o recebimento de comunicações importantes relacionadas à sua conta e aos ' +
          'serviços utilizados.',
      ],
    },
    {
      id: 'disposicoes-gerais',
      titulo: '18. Disposições Gerais',
      paragrafos: [
        'Caso alguma disposição destes Termos de Uso seja considerada inválida ou inexigível, as ' +
          'demais disposições permanecerão válidas e continuarão produzindo seus efeitos.',
        'A eventual ausência de cobrança ou aplicação imediata de determinada regra pelo MenuPoint ' +
          'não significa renúncia ao direito de exigir seu cumprimento posteriormente.',
        'Estes Termos de Uso serão regidos pelas leis da República Federativa do Brasil. As ' +
          'relações de consumo eventualmente existentes deverão observar a legislação brasileira ' +
          'aplicável, incluindo o Código de Defesa do Consumidor e demais normas pertinentes.',
      ],
    },
    {
      id: 'contato-e-atualizacoes',
      titulo: '19. Contato e Atualizações',
      paragrafos: [
        'Eventuais dúvidas, reclamações ou solicitações relacionadas ao MenuPoint deverão ser ' +
          'encaminhadas pelos canais oficiais de atendimento disponibilizados pela plataforma.',
        'Ao selecionar a opção "Li e concordo com os Termos de Uso", criar uma conta, realizar um ' +
          'pedido ou utilizar as funcionalidades do MenuPoint, o usuário declara que teve acesso a ' +
          'estes Termos, compreendeu seu conteúdo e concorda com as condições estabelecidas.',
        'O MenuPoint poderá atualizar estes Termos de Uso sempre que necessário. A versão vigente ' +
          'estará disponível na plataforma, sendo responsabilidade do usuário consultar ' +
          'periodicamente eventuais alterações.',
      ],
    },
  ],
  rodape: 'MenuPoint — O ponto que transforma fome em vendas.',
};