from django import forms

class RegistrationForm(forms.Form):
    username = forms.CharField(
        label='ユーザー名(12文字以下)',
        max_length=12,
        required=True
    )
    password = forms.CharField(
        label='パスワード(8～24文字)',
        min_length=8,
        max_length=24,
        widget=forms.PasswordInput,
        required=True
    )

class LoginForm(forms.Form):
    username = forms.CharField(
        label='ユーザー名',
        required=True
    )
    password = forms.CharField(
        label='パスワード',
        widget=forms.PasswordInput,
        required=True
    )
