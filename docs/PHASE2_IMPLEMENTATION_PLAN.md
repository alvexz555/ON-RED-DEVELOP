# ON RED — Fase 2 | Plano de implementação

**Branch:** `preview/phase2-foundation-2026-11-23`  
**Base preservada:** `main` em `b26a8db6a6b00edeb2af2c8d365ddd859ec474d1`  
**Fonte de produto:** [Checklist oficial do ON RED](https://app.notion.com/p/416426dfcf7180f28fe9e781fc3aed8b?pvs=204)

## Regra de isolamento

A Fase 2 será construída em módulos novos. Nenhuma mecânica, arquivo ou parâmetro da Fase 1 será alterado para acomodá-la. A integração no motor principal e a liberação no menu ficam para uma etapa posterior, depois dos testes isolados e da aprovação do responsável pelo projeto.

## Identidade preservada

- Canvas 2D e geometria simples, preenchida e legível.
- Paleta ON RED: vermelho para o jogador, azul para ameaças/ambiente, branco para estados elétricos e preto para contraste.
- Feedback visual claro, sem excesso de partículas ou interfaces que escondam a arena.
- A Fase 2 deve parecer uma evolução do mesmo arcade, não uma troca de gênero.

## Requisitos confirmados no documento

- HP máximo: **80**.
- Total de vidas: **4**.
- Energia elétrica máxima: **100%**.
- Jogador começa em vermelho claro e clareia gradualmente até branco quando chega a 100%.
- Serras menores: geometria rotativa, colisões e eliminação usando energia.
- DASH: habilidade de deslocamento e mecanismo ofensivo contra a Serra Gigante.
- Lasers com brechas: aviso antes do disparo e redução da área segura.
- Áreas elétricas: pontos da arena para carregar energia.
- MERGE adaptado à Fase 2.
- Boss: Serra Gigante triangular azul preenchida. O ciclo de combate é sobreviver, carregar energia, chegar a 100%, aproximar-se e acertar com DASH.
- Vencer o Boss registra o recorde e libera somente a fase seguinte.

## Decisões ainda pendentes no documento

Não serão inventados nesta etapa: HP e padrões completos do Boss, velocidade de carga, frequência/quantidade/duração das áreas elétricas, decaimento de energia, perda de energia ao receber dano, consumo de energia por DASH, dano por acerto, alcance do golpe, parâmetros de serras, temporização e geometria dos lasers, regra exata do MERGE adaptado e balanceamento da dificuldade.

Esses parâmetros devem ser configuráveis e só serão fixados após testes de gameplay e decisão explícita.

## Sequência de implementação

1. Fundação isolada de estado e regras-base da Fase 2.
2. Módulo de energia e áreas elétricas.
3. Serras, rotação, colisão e eliminação.
4. DASH e integração com combate.
5. Lasers, avisos, brechas e área segura.
6. MERGE adaptado e HUD.
7. Serra Gigante e progressão.
8. Testes de regressão da Fase 1, testes mobile/desktop e revisão visual.
9. Pull request para avaliação. **Nunca fazer merge automático em `main`.**

## Critério de segurança

A Fase 1 precisa continuar funcionando sem carregar ou depender dos módulos da Fase 2. Enquanto a Fase 2 não estiver pronta, o menu atual continua exibindo a Fase 2 como atualização futura.
