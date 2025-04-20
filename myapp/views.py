from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.contrib import messages
from .forms import RegistrationForm, LoginForm

def index(request):
    # メインページ: 登録フォームとログインフォームを同時に表示
    reg_form = RegistrationForm()
    login_form = LoginForm()
    return render(request, 'myapp/index.html', {
        'reg_form': reg_form,
        'login_form': login_form
    })

def register(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            # ユーザー名が既に存在しないか確認
            if User.objects.filter(username=username).exists():
                messages.error(request, 'このユーザー名は既に登録されています。')
                return redirect('index')
            # ユーザーを作成 (パスワードは自動的にハッシュ化される)
            User.objects.create_user(username=username, password=password)
            messages.success(request, '登録完了！サインインできます。')
        else:
            messages.error(request, 'フォームの入力に誤りがあります。')
    return redirect('index')

def user_login(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('success')  # 成功時はリダイレクトのみ
            else:
                messages.error(request, 'ユーザー名またはパスワードが正しくありません。')
        else:
            messages.error(request, 'フォームの入力に誤りがあります。')
        
        # エラー時は常にここでレンダリング
        return render(request, 'myapp/index.html', {
            'reg_form': RegistrationForm(),
            'login_form': form
        })
    
    # GETリクエストの場合
    return redirect('index')

def success(request):
    # ログイン後にアクセスする簡単な成功ページ
    if not request.user.is_authenticated:
        return redirect('index')
    return render(request, 'myapp/success.html')
