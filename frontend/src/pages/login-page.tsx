/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react'
import { BrainCircuit, CandlestickChart, LockKeyhole, ShieldCheck } from 'lucide-react'

import { loginWithPassword } from '../lib/api'
import type { SessionResponse } from '../types/api'

type LoginPageProps = {
  onLogin: (session: SessionResponse) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const session = await loginWithPassword(password)
      onLogin(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.24),transparent_26%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.94),rgba(241,245,249,0.96))] p-4 font-sans">
      <div className="pointer-events-none absolute -left-28 top-0 h-[44rem] w-[44rem] rounded-full bg-blue-500/25 blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-[34rem] w-[34rem] rounded-full bg-indigo-500/20 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.15)_1px,transparent_1px)] bg-[size:3.6rem_3.6rem] opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_62%,transparent_100%)]" />

      <div className="relative z-10 grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="flex-1 select-none space-y-8 px-2 lg:max-w-xl lg:pr-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/50 bg-blue-50/60 px-2.5 py-0.5 shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600">
                Quant Engine v1.0
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl md:leading-none">
                AI 股票分析助手
              </h1>
              <p className="max-w-lg text-sm font-medium leading-7 text-slate-400 md:text-base">
                多周期行情感知、结构化智能研判与独立会话隔离，统一沉淀在同一套高可用的金融终端决策入口中。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: CandlestickChart,
                title: '多周期 K 线行情矩阵',
                description: '全自动对齐日 K、周 K、月 K 级多时序指标，实现均线与量价结构的深度联动穿透。',
              },
              {
                icon: BrainCircuit,
                title: 'AI 结构化策略研判',
                description: '基于底层深度推理算力，秒级输出高确定性的多空评级、全维度风险分层与逻辑摘要。',
              },
              {
                icon: ShieldCheck,
                title: '金融级会话历史隔离',
                description: '严格按终端区分独立存储分析状态，多端互不干扰，确保交易数据的极高私密性。',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-2xl border border-white/40 bg-white/40 p-4 transition-all duration-300 hover:border-blue-100 hover:bg-white/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100/50 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 shadow-sm shadow-blue-500/5">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black tracking-tight text-slate-800">{title}</h2>
                  <p className="text-xs font-medium leading-6 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex max-w-md items-center gap-2.5 rounded-xl border border-white/30 bg-white/30 px-4 py-3.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              系统就绪 <span className="mx-1 text-slate-300">|</span>{' '}
              <span className="font-medium text-slate-400">输入访问口令验证身份</span>
            </span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl rounded-[2.2rem] border border-white/85 bg-white/80 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.15)] backdrop-blur-2xl lg:p-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/85 px-3 py-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.45)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-600">
                Secure Access
              </span>
            </div>
            <div className="space-y-3 border-b border-slate-100 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Identity Gateway
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    输入访问口令
                  </h2>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-3 py-2 text-right shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                    Verified Route
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">会话隔离已启用</p>
                </div>
              </div>
              <p className="max-w-lg text-sm leading-7 text-slate-500">
                输入访问口令后进入专属分析空间，继续查看当前会话下的历史记录与研判结果。
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4.5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Access Token / 访问口令
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入系统访问口令"
                  className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/75 py-4 pl-16 pr-4 text-base font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-slate-300 focus:-translate-y-0.5 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_5px_rgba(59,130,246,0.10),0_16px_30px_rgba(37,99,235,0.08)]"
                  required
                />
              </div>
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span>服务端身份校验</span>
                <span>30 天会话有效期</span>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold text-rose-800">访问验证失败</p>
                <p className="mt-1 leading-6">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-2xl border border-blue-500/60 bg-[linear-gradient(135deg,#2563eb,#1d4ed8_48%,#4338ca)] py-4 text-base font-black tracking-[0.04em] text-white shadow-[0_18px_40px_rgba(37,99,235,0.30),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_24px_46px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.24)] active:translate-y-0 active:shadow-[0_10px_24px_rgba(37,99,235,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '验证中...' : '验证并进入系统'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            当前入口已启用服务端会话校验，仅展示当前会话下的历史记录与分析结果。
          </div>
        </section>
      </div>
    </div>
  )
}
