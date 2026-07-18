-- =====================================================================
-- Family Compass - Multi-thread Chat Migration SQL
-- =====================================================================
-- 
-- 以下のSQLスクリプトをSupabaseの「SQL Editor」で実行してください。
-- このスクリプトは既存のデータを破壊せずに以下の処理を行います：
-- 
-- 1. `chat_sessions`（スレッド）テーブルの新規作成
-- 2. `chat_sessions` テーブルへのRLS（行レベルセキュリティ）ポリシーの適用
-- 3. `conversations` テーブルに `session_id` カラムを追加し、外部キーを設定
-- 4. 既存の `conversations` のメッセージを「以前の相談」というデフォルトセッションに自動移行
-- 

-- 1. chat_sessions テーブルの作成
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '新しい相談',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS（Row Level Security）の有効化
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- 自分が所有するセッションのみ操作可能なポリシーを設定
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_sessions' AND policyname = 'Users can manage their own chat sessions'
    ) THEN
        CREATE POLICY "Users can manage their own chat sessions" 
        ON public.chat_sessions
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. conversations テーブルに session_id カラムを追加（既存テーブルがある場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.conversations ADD COLUMN session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. 既存の conversations データをデフォルトセッションに移行する
DO $$
DECLARE
    u_id UUID;
    s_id UUID;
BEGIN
    -- session_id が NULL の既存メッセージがある場合、ユーザーごとに「以前の相談」セッションを作成して紐付けます
    FOR u_id IN SELECT DISTINCT user_id FROM public.conversations WHERE session_id IS NULL LOOP
        -- 新しいセッションを作成
        INSERT INTO public.chat_sessions (user_id, title, created_at)
        VALUES (u_id, '以前の相談', now())
        RETURNING id INTO s_id;

        -- 既存の conversations メッセージを紐付け
        UPDATE public.conversations
        SET session_id = s_id
        WHERE user_id = u_id AND session_id IS NULL;
    END LOOP;
END $$;

-- =====================================================================
-- 4. daily_messages テーブルの作成とRLS設定（日替わりメッセージ機能）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.daily_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

-- RLS（Row Level Security）の有効化
ALTER TABLE public.daily_messages ENABLE ROW LEVEL SECURITY;

-- 自分が所有する日替わりメッセージのみ操作可能なポリシーを設定
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_messages' AND policyname = 'Users can manage their own daily messages'
    ) THEN
        CREATE POLICY "Users can manage their own daily messages" 
        ON public.daily_messages
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================================
-- 4.4. chat_sessions テーブルに summary（相談要約）カラムを追加
-- =====================================================================
-- AIが各セッションの会話を自動要約して保存し、新しい相談スレッドで
-- 過去の文脈を引き継ぐために使用します。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'summary'
    ) THEN
        ALTER TABLE public.chat_sessions ADD COLUMN summary TEXT DEFAULT NULL;
    END IF;
END $$;

-- =====================================================================
-- 4.5. family_members テーブルに relationship（続柄）カラムを追加
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'family_members' AND column_name = 'relationship'
    ) THEN
        ALTER TABLE public.family_members ADD COLUMN relationship TEXT;
    END IF;
END $$;

-- =====================================================================
-- 5. session_memos テーブルの作成とRLS設定（相談メモ機能）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.session_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    memo_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS（Row Level Security）の有効化
ALTER TABLE public.session_memos ENABLE ROW LEVEL SECURITY;

-- 自分が所有するメモのみ操作可能なポリシーを設定
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'session_memos' AND policyname = 'Users can manage their own session memos'
    ) THEN
        CREATE POLICY "Users can manage their own session memos" 
        ON public.session_memos
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================================
-- 6. chat_sessions テーブルに mode カラムを追加（相談モード/解決モード）
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'mode'
    ) THEN
        ALTER TABLE public.chat_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'counsel';
    END IF;
END $$;

-- =====================================================================
-- 7. session_actions テーブルの作成とRLS設定（アクションプラン機能）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.session_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'done'
    reflection TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS（Row Level Security）の有効化
ALTER TABLE public.session_actions ENABLE ROW LEVEL SECURITY;

-- 自分が所有するアクションのみ操作可能なポリシーを設定
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'session_actions' AND policyname = 'Users can manage their own session actions'
    ) THEN
        CREATE POLICY "Users can manage their own session actions"
        ON public.session_actions
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================================
-- 8. chat_sessions テーブルに is_favorite カラムを追加（お気に入り機能）
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'is_favorite'
    ) THEN
        ALTER TABLE public.chat_sessions ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

