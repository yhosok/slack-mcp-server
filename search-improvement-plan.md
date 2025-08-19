# 検索機能改善実装計画

## 📊 現状分析

### ✅ 既に実装されている優れた機能
1. **多言語対応** - 日本語/英語の高度なテキスト処理（2025-08-10改善）
2. **決定論的アルゴリズム** - Jaccard係数による一貫した類似度計算
3. **TypeSafeAPI** - 完全な型安全性とエラーハンドリング
4. **ページネーション** - 安全なデフォルト値（max_pages: 10, max_items: 1000）

### ⚠️ 改善が必要な領域

#### 1. 検索クエリ処理の強化
**現状の問題点**:
```typescript
// 現在: 基本的なエスケープのみ (src/slack/services/threads/thread-service.ts)
.replace(/["]/g, '\\"')
.replace(/[\r\n]/g, ' ')
```

**改善内容**:
- Slack Search APIの高度な検索演算子のサポート
- ブール演算子（AND, OR, NOT）の適切な処理
- フレーズ検索、ワイルドカード検索の実装

#### 2. キャッシュ機構の実装
**現状の問題点**:
- チャンネル名解決が毎回API呼び出し
- 検索結果のキャッシュなし

**改善内容**:
- 検索結果の時間制限付きキャッシュ（LRU）
- チャンネル情報の拡張キャッシュ
- ユーザー情報のバルクキャッシュ

#### 3. 検索結果のランキング改善
**現状の問題点**:
- 単純な重要度スコアリング
- コンテキスト考慮が限定的

**改善内容**:
- TF-IDFベースの関連性スコアリング
- 時間的近接性の重み付け
- ユーザーインタラクション（リアクション、返信数）の考慮

#### 4. Bot Token互換の検索代替実装
**現状の問題点**:
- 多くの検索機能がUser Token必須
- Bot Tokenユーザーに制限

**改善内容**:
- `conversations.history`を使った代替検索実装
- チャンネル横断検索のバッチ処理
- インデックスベースの検索補助機能

#### 5. 未完了機能の実装
**現状のTODO**:
```typescript
// src/slack/services/threads/thread-service.ts:767
decisionsMade: [], // TODO: Extract from analysis
```

## 🚀 実装フェーズ

### フェーズ1: 検索クエリ処理の強化（優先度: 高）

#### 実装内容
1. **高度なクエリパーサーの実装**
   - ファイル: `src/slack/utils/search-query-parser.ts` (新規作成)
   - Slack Search API演算子のサポート追加
   - ブール演算子（AND, OR, NOT）の処理
   - フレーズ検索とワイルドカードのサポート
   - 特殊文字の適切なエスケープ処理

2. **既存サービスの改修**
   - `src/slack/services/messages/message-service.ts`
   - `src/slack/services/threads/thread-service.ts`
   - `src/slack/services/files/file-service.ts`

3. **テストの追加**
   - `src/__tests__/search-query-parser.test.ts` (新規作成)
   - 複雑なクエリパターンのテストケース
   - エッジケースのカバレッジ向上

### フェーズ2: キャッシュシステムの実装（優先度: 高）

#### 実装内容
1. **LRUキャッシュの導入**
   - ファイル: `src/slack/infrastructure/cache/lru-cache.ts` (新規作成)
   - ファイル: `src/slack/infrastructure/cache/search-cache.ts` (新規作成)
   - 検索結果の時間制限付きキャッシュ
   - チャンネル/ユーザー情報の効率的なキャッシュ

2. **キャッシュ統合**
   - 既存のチャンネル名キャッシュの拡張
   - サービスレイヤーへのキャッシュ統合

3. **キャッシュ無効化戦略**
   - TTLベースの自動無効化
   - イベントベースの選択的無効化

### フェーズ3: 検索ランキングアルゴリズムの改善（優先度: 中）

#### 実装内容
1. **関連性スコアリングの実装**
   - ファイル: `src/slack/analysis/ranking/relevance-scorer.ts` (新規作成)
   - TF-IDFアルゴリズムの導入
   - 時間的近接性の重み付け
   - ユーザーエンゲージメントメトリクスの統合

2. **Decision Extraction機能の完成**
   - `src/slack/analysis/thread/decision-extractor.ts` (新規作成)
   - TODO項目の実装（thread-service.ts:767）

### フェーズ4: Bot Token互換検索の実装（優先度: 中）

#### 実装内容
1. **代替検索メソッドの開発**
   - ファイル: `src/slack/services/search/bot-compatible-search.ts` (新規作成)
   - conversations.historyベースの検索
   - チャンネル横断バッチ検索
   - プログレッシブ検索結果の返却

### フェーズ5: エラーハンドリングの改善（優先度: 低）

#### 実装内容
1. **高度なリトライメカニズム**
   - ファイル: `src/slack/infrastructure/retry/exponential-backoff.ts` (新規作成)
   - Exponential backoffの実装
   - エラータイプ別戦略
   - 部分的成功の処理

## 📝 作業手順

### 各フェーズの進め方
1. **事前調査**: context7で最新のベストプラクティスを確認
2. **設計**: serenaでcodebase理解とアーキテクチャ検討
3. **TDD実装**: Red-Green-Refactorサイクル
   - Red: テストケース作成（失敗）
   - Green: 最小限の実装（成功）
   - Refactor: コード品質向上
4. **統合テスト**: 既存機能との互換性確認
5. **レビュー**: コード品質と設計の確認

### 品質基準
- **Type Safety**: `any`型の使用禁止
- **Test Coverage**: 新機能90%以上
- **Documentation**: JSDocコメント必須
- **Performance**: 検索レスポンス時間の改善測定
- **Backward Compatibility**: 既存API互換性維持

## 📊 成功指標

### パフォーマンス目標
- 検索レスポンス時間: 50%向上
- キャッシュヒット率: 70%以上
- メモリ使用量: 現状維持
- API呼び出し回数: 30%削減

### 機能性目標
- 複雑検索クエリ対応: 100%
- Bot Token検索カバレッジ: 80%向上
- 検索精度: 主観的評価で20%向上
- エラー処理: ゼロクラッシュ

## 🔧 技術スタック

### 新規依存関係（予定）
- **キャッシュ**: `lru-cache` または自作LRU実装
- **テキスト処理**: 既存の日本語処理を拡張
- **算術**: TF-IDF計算用のユーティリティ

### 既存技術活用
- **TypeScript**: 厳密な型定義
- **Zod**: 入力検証
- **ts-pattern**: パターンマッチング
- **Jest**: テストフレームワーク
- **Slack Web API**: 既存のクライアント

---

*作成日: 2025-01-19*
*最終更新: 2025-01-19*