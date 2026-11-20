'use client';
import {
AlertCircle,
CheckCircle2,
FileText,
Mail,
Save,
ShieldCheck,
Sparkles
} from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { RefinementStyle } from '../../../lib/refinement';
import {
fmt
} from '../../../lib/rules';
import type { DashboardController } from './use-dashboard';
type Props=Pick<DashboardController,"date"|"extra"|"setExtra"|"nextSteps"|"setNextSteps"|"refining"|"generate"|"refinementStyle"|"setRefinementStyle"|"setRefinedBody"|"setChosen"|"generated"|"saving"|"refine"|"refinedBody"|"refineError"|"excluded"|"subject"|"setSubject"|"body"|"setBody"|"chosen"|"copy"|"saveGenerated">;
export default function ReportEditor({date,extra,setExtra,nextSteps,setNextSteps,refining,generate,refinementStyle,setRefinementStyle,setRefinedBody,setChosen,generated,saving,refine,refinedBody,refineError,excluded,subject,setSubject,body,setBody,chosen,copy,saveGenerated}:Props){return ((
              <div className={styles.reportGrid}>
                <section className={styles.card}>
                  <div className={styles.cardhead}>
                    <div>
                      <p className={styles.eyebrow}>GERADOR DE E-MAIL</p>
                      <h2>Personalizar report</h2>
                    </div>
                    <span className={styles.pill}>{fmt(date)}</span>
                  </div>
                  <label className={styles.field}>
                    Observações gerais
                    <textarea
                      rows={4}
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      placeholder="Informações adicionais que devem constar no relatório"
                    />
                  </label>
                  <label className={styles.field}>
                    Pendências e próximos passos (um por linha)
                    <textarea
                      rows={6}
                      value={nextSteps}
                      onChange={(e) => setNextSteps(e.target.value)}
                      placeholder="Confirmar pagamento agendado...&#10;Aguardar avaliação da renegociação..."
                    />
                  </label>
                  <div className={styles.note}>
                    <ShieldCheck size={17} /> A geração padrão funciona sem IA e utiliza somente os
                    registros salvos localmente.
                  </div>
                  <button className={styles.primary} disabled={refining} onClick={generate}>
                    <FileText size={17} /> Gerar report padrão
                  </button>
                  <label className={styles.field}>
                    Estilo de refinamento
                    <select
                      disabled={refining}
                      value={refinementStyle}
                      onChange={(e) => {
                        setRefinementStyle(e.target.value as RefinementStyle);
                        setRefinedBody('');
                        setChosen('original');
                      }}
                    >
                      <option value="formal">Formal</option>
                      <option value="executive">Executivo</option>
                      <option value="detailed">Detalhado</option>
                    </select>
                  </label>
                  <p className={styles.subhead}>
                    A IA recebe apenas títulos de seções. Fatos e indicadores são preservados pelo
                    servidor. O refinamento utiliza os registros salvos; edições manuais não são
                    enviadas.
                  </p>
                  <button
                    className={styles.secondary}
                    disabled={!generated || refining || saving}
                    onClick={refine}
                  >
                    <Sparkles size={17} />{' '}
                    {refining ? 'Refinando…' : refinedBody ? 'Refinar novamente' : 'Refinar com IA'}
                  </button>
                  {refineError && (
                    <div className={styles.alert} role="alert">
                      {refineError}
                    </div>
                  )}
                  {refinedBody && (
                    <p className={styles.ok} role="status">
                      Refinamento concluído
                    </p>
                  )}
                </section>
                <section className={styles.card}>
                  <div className={styles.cardhead}>
                    <div>
                      <p className={styles.eyebrow}>PRÉVIA EDITÁVEL</p>
                      <h2>Relatório para envio</h2>
                    </div>
                    {generated && (
                      <span className={styles.ok}>
                        <CheckCircle2 size={15} /> Gerado
                      </span>
                    )}
                  </div>
                  {excluded > 0 && (
                    <div className={styles.alert}>
                      <AlertCircle size={16} />
                      {excluded}{' '}
                      {excluded === 1
                        ? 'registro incompleto foi ignorado'
                        : 'registros incompletos foram ignorados'}
                      .
                    </div>
                  )}
                  <label className={styles.field}>
                    Assunto
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </label>
                  <label className={styles.field}>
                    Relatório original (editável)
                    <textarea
                      className={styles.reportText}
                      value={body}
                      rows={23}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Clique em Gerar report padrão para criar uma prévia."
                    />
                  </label>
                  {refinedBody && (
                    <label className={styles.field}>
                      Relatório refinado com IA (editável)
                      <textarea
                        className={styles.reportText}
                        rows={23}
                        value={refinedBody}
                        onChange={(e) => setRefinedBody(e.target.value)}
                      />
                    </label>
                  )}
                  <label className={styles.field}>
                    Versão para copiar e salvar
                    <select
                      value={chosen}
                      onChange={(e) => setChosen(e.target.value as 'original' | 'refined')}
                    >
                      <option value="original">Original</option>
                      {refinedBody && <option value="refined">Refinada com IA</option>}
                    </select>
                  </label>
                  <div className={styles.reportButtons}>
                    <button className={styles.secondary} onClick={copy}>
                      <Mail size={17} /> Copiar texto
                    </button>
                    <button
                      className={styles.primary}
                      onClick={saveGenerated}
                      disabled={!generated || saving || refining}
                    >
                      <Save size={17} /> Salvar versão
                    </button>
                  </div>
                </section>
              </div>
            ));}
