import requests
import json
from rich import print as rich_print
from rich.json import JSON

BASE_URL = "http://localhost:8000"


def print_result(
    name, url, response, success, err_msg=None, req_body=None, headers=None
):
    rich_print(f"\n[bold cyan]【{name}】[/bold cyan]")
    rich_print(f"[bold]URL:[/bold] {url}")
    if headers is not None:
        rich_print("[bold]请求头:[/bold]")
        rich_print(JSON(json.dumps(headers, ensure_ascii=False)))
    if req_body is not None:
        rich_print("[bold]请求体:[/bold]")
        rich_print(JSON(json.dumps(req_body, ensure_ascii=False)))
    rich_print("[bold]响应内容:[/bold]")
    try:
        rich_print(JSON(response.text))
    except json.JSONDecodeError:
        rich_print(response.text)
    if success:
        rich_print("[bold green]结果: 成功[/bold green]\n")
    else:
        rich_print(f"[bold red]结果: 失败 ({err_msg})[/bold red]\n")


def test_health():
    url = f"{BASE_URL}/health"
    try:
        response = requests.get(url)
        assert response.status_code == 200
        assert response.text == "OK"
        print_result("健康检查", url, response, True)
        return True
    except Exception as e:
        print_result("健康检查", url, response, False, str(e))
        return False


def test_register():
    url = f"{BASE_URL}/auth/register"
    user_data = {
        "username": "testuser",
        "password": "testpass123",
        "nickname": "测试用户",
    }
    try:
        response = requests.post(url, json=user_data)
        assert response.status_code == 200
        print_result("注册", url, response, True, req_body=user_data)
        return True, response.json()
    except Exception as e:
        print_result("注册", url, response, False, str(e), req_body=user_data)
        return False, None


def test_login():
    url = f"{BASE_URL}/auth/login"
    login_data = {"username": "testuser", "password": "testpass123"}
    try:
        response = requests.post(url, json=login_data)
        assert response.status_code == 200
        print_result("登录", url, response, True, req_body=login_data)
        return True, response.json()
    except Exception as e:
        print_result("登录", url, response, False, str(e), req_body=login_data)
        return False, None


def test_me(token):
    url = f"{BASE_URL}/me"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        print_result("获取用户信息", url, response, True, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result("获取用户信息", url, response, False, str(e), headers=headers)
        return False, None


def test_update_me_nickname(token, new_nickname):
    url = f"{BASE_URL}/me"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"nickname": new_nickname}
    try:
        response = requests.patch(url, json=payload, headers=headers)
        assert response.status_code == 200
        print_result("更新用户昵称", url, response, True, req_body=payload, headers=headers)
        return True
    except Exception as e:
        print_result("更新用户昵称", url, response, False, str(e), req_body=payload, headers=headers)
        return False


def test_delete_me(token):
    url = f"{BASE_URL}/me"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.delete(url, headers=headers)
        assert response.status_code == 200
        print_result("删除用户账号", url, response, True, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result("删除用户账号", url, response, False, str(e), headers=headers)
        return False, None


def test_stats(token):
    url = f"{BASE_URL}/me/stats"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        print_result("获取用户统计信息", url, response, True, headers=headers)
        return True
    except Exception as e:
        print_result("获取用户统计信息", url, response, False, str(e), headers=headers)
        return False


def test_memo_ids(token):
    url = f"{BASE_URL}/memo/search"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        ids = []
        cursor = None
        response = None
        while True:
            payload = {"cursor": cursor, "page_size": 50} if cursor else {"page_size": 50}
            response = requests.post(url, json=payload, headers=headers)
            assert response.status_code == 200
            page = response.json()
            ids.extend(item["id"] for item in page.get("items", []))
            cursor = page.get("next_cursor")
            if not page.get("has_more"):
                break
        assert response.status_code == 200
        print_result("获取备忘录ID列表", url, response, True, req_body={}, headers=headers)
        return True, ids
    except Exception as e:
        print_result(
            "获取备忘录ID列表", url, response, False, str(e), req_body={}, headers=headers
        )
        return False, None


def test_memo_ids_with_tag(token, tag):
    url = f"{BASE_URL}/memo/search"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"tag": tag, "page_size": 50}
    try:
        ids = []
        response = None
        cursor = None
        while True:
            page_payload = dict(payload)
            if cursor:
                page_payload["cursor"] = cursor
            response = requests.post(url, json=page_payload, headers=headers)
            assert response.status_code == 200
            page = response.json()
            ids.extend(item["id"] for item in page.get("items", []))
            cursor = page.get("next_cursor")
            if not page.get("has_more"):
                break
        print_result(
            f"获取标签'{tag}'的备忘录ID列表",
            url,
            response,
            True,
            req_body=payload,
            headers=headers,
        )
        return True, ids
    except Exception as e:
        print_result(
            f"获取标签'{tag}'的备忘录ID列表",
            url,
            response,
            False,
            str(e),
            req_body=payload,
            headers=headers,
        )
        return False, None


def test_memo_ids_with_nested_tag(token, nested_tag):
    url = f"{BASE_URL}/memo/search"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"tag": nested_tag, "page_size": 50}
    try:
        ids = []
        response = None
        cursor = None
        while True:
            page_payload = dict(payload)
            if cursor:
                page_payload["cursor"] = cursor
            response = requests.post(url, json=page_payload, headers=headers)
            assert response.status_code == 200
            page = response.json()
            ids.extend(item["id"] for item in page.get("items", []))
            cursor = page.get("next_cursor")
            if not page.get("has_more"):
                break
        print_result(
            f"获取多级标签'{nested_tag}'的备忘录ID列表",
            url,
            response,
            True,
            req_body=payload,
            headers=headers,
        )
        return True, ids
    except Exception as e:
        print_result(
            f"获取多级标签'{nested_tag}'的备忘录ID列表",
            url,
            response,
            False,
            str(e),
            req_body=payload,
            headers=headers,
        )
        return False, None


def test_create_memo(token):
    url = f"{BASE_URL}/memo"
    headers = {"Authorization": f"Bearer {token}"}
    memo_data = {"content": "这是一条测试备忘录", "tags": ["测试", "备忘录"]}
    try:
        response = requests.post(url, json=memo_data, headers=headers)
        assert response.status_code == 200
        memo_id = response.json()  # 直接获取返回的ID
        print_result(
            "创建备忘录", url, response, True, req_body=memo_data, headers=headers
        )
        return True, memo_id
    except Exception as e:
        print_result(
            "创建备忘录",
            url,
            response,
            False,
            str(e),
            req_body=memo_data,
            headers=headers,
        )
        return False, None


def test_create_memo_with_nested_tags(token):
    url = f"{BASE_URL}/memo"
    headers = {"Authorization": f"Bearer {token}"}
    memo_data = {
        "content": "这是一条带有多级标签的测试备忘录",
        "tags": ["测试/多级/标签", "备忘录/嵌套"],
    }
    try:
        response = requests.post(url, json=memo_data, headers=headers)
        assert response.status_code == 200
        memo_id = response.json()  # 直接获取返回的ID
        print_result(
            "创建带有多级标签的备忘录",
            url,
            response,
            True,
            req_body=memo_data,
            headers=headers,
        )
        return True, memo_id
    except Exception as e:
        print_result(
            "创建带有多级标签的备忘录",
            url,
            response,
            False,
            str(e),
            req_body=memo_data,
            headers=headers,
        )
        return False, None


def test_get_memo(token, memo_id):
    url = f"{BASE_URL}/memo/{memo_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        print_result("获取备忘录内容", url, response, True, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result("获取备忘录内容", url, response, False, str(e), headers=headers)
        return False, None


def test_get_memos(token, memo_ids):
    url = f"{BASE_URL}/memo/batch"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.post(url, json=memo_ids, headers=headers)
        assert response.status_code == 200
        print_result(
            "批量获取备忘录内容",
            url,
            response,
            True,
            req_body=memo_ids,
            headers=headers,
        )
        return True, response.json()
    except Exception as e:
        print_result(
            "批量获取备忘录内容",
            url,
            response,
            False,
            str(e),
            req_body=memo_ids,
            headers=headers,
        )
        return False, None


def test_update_memo(token, memo_id):
    url = f"{BASE_URL}/memo/{memo_id}"
    headers = {"Authorization": f"Bearer {token}"}
    update_data = {"content": "这是更新后的备忘录内容", "tags": ["测试", "更新"]}
    try:
        response = requests.put(url, json=update_data, headers=headers)
        assert response.status_code == 200
        print_result(
            "更新备忘录", url, response, True, req_body=update_data, headers=headers
        )
        return True, response.json()
    except Exception as e:
        print_result(
            "更新备忘录",
            url,
            response,
            False,
            str(e),
            req_body=update_data,
            headers=headers,
        )
        return False, None


def test_delete_memo(token, memo_id):
    url = f"{BASE_URL}/memo/{memo_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.delete(url, headers=headers)
        assert response.status_code == 200
        print_result("删除备忘录", url, response, True, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result("删除备忘录", url, response, False, str(e), headers=headers)
        return False, None


def test_get_tag_meta(token):
    url = f"{BASE_URL}/tag/meta"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        print_result("获取标签元信息", url, response, True, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result("获取标签元信息", url, response, False, str(e), headers=headers)
        return False, None


def test_update_tag(token, old_tag, new_tag):
    url = f"{BASE_URL}/tag/{old_tag}"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"new_tag": new_tag}
    try:
        response = requests.put(url, json=payload, headers=headers)
        assert response.status_code == 200
        print_result("更新标签", url, response, True, req_body=payload, headers=headers)
        return True, response.json()
    except Exception as e:
        print_result(
            "更新标签", url, response, False, str(e), req_body=payload, headers=headers
        )
        return False, None


def test_update_nested_tag(token, old_tag, new_tag):
    # 将多级标签中的 / 替换为 | 用于URL
    url_tag = old_tag.replace("/", "|")
    url = f"{BASE_URL}/tag/{url_tag}"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"new_tag": new_tag}
    try:
        response = requests.put(url, json=payload, headers=headers)
        assert response.status_code == 200
        print_result(
            "更新多级标签", url, response, True, req_body=payload, headers=headers
        )
        return True, response.json()
    except Exception as e:
        print_result(
            "更新多级标签",
            url,
            response,
            False,
            str(e),
            req_body=payload,
            headers=headers,
        )
        return False, None


def main():
    rich_print("[bold]开始测试 API...[/bold]")
    all_passed = True

    # 测试健康检查
    ok = test_health()
    all_passed = all_passed and ok

    # 测试注册
    ok, user = test_register()
    all_passed = all_passed and ok

    # 测试登录
    ok, auth = test_login()
    all_passed = all_passed and ok

    memo_id = None
    nested_memo_id = None

    # 测试获取用户信息
    if ok and auth:
        token = auth.get("token")
        if token:
            ok, user_info = test_me(token)
            all_passed = all_passed and ok

            # 测试更新用户昵称
            if ok:
                new_nickname = "更新后的昵称"
                ok = test_update_me_nickname(token, new_nickname)
                all_passed = all_passed and ok

                # 验证昵称是否更新成功
                if ok:
                    ok, updated_user = test_me(token)
                    if (
                        ok
                        and updated_user
                        and updated_user.get("nickname") == new_nickname
                    ):
                        rich_print("[bold green]用户昵称更新成功![/bold green]")
                    else:
                        rich_print("[bold red]用户昵称更新失败![/bold red]")
                        all_passed = False

            # 测试获取用户统计信息
            ok = test_stats(token)
            all_passed = all_passed and ok

            # 测试获取备忘录ID列表
            ok, ids = test_memo_ids(token)
            all_passed = all_passed and ok

            # 测试创建备忘录
            ok, created_memo = test_create_memo(token)
            all_passed = all_passed and ok

            # 测试创建带有多级标签的备忘录
            ok, created_nested_memo = test_create_memo_with_nested_tags(token)
            all_passed = all_passed and ok

            # 测试批量获取备忘录内容
            if ok and created_memo is not None and created_nested_memo is not None:
                memo_ids_to_get = [created_memo, created_nested_memo]
                ok, memos = test_get_memos(token, memo_ids_to_get)
                all_passed = all_passed and ok
                if ok:
                    rich_print(
                        f"[bold green]成功批量获取 {len(memos)} 条备忘录内容![/bold green]"
                    )
                    # 验证返回的备忘录数量是否正确
                    if len(memos) == len(memo_ids_to_get):
                        rich_print("[bold green]批量获取备忘录数量正确![/bold green]")
                    else:
                        rich_print(
                            f"[bold red]批量获取备忘录数量不正确! 期望 {len(memo_ids_to_get)}, 实际 {len(memos)}[/bold red]"
                        )
                        all_passed = False

            # 添加新的测试：测试带单标签参数的备忘录ID列表
            if ok and created_memo is not None:
                # 获取刚创建的备忘录，提取其标签
                ok, memo = test_get_memo(token, created_memo)
                if ok and memo and "tags" in memo and len(memo["tags"]) > 0:
                    tag = memo["tags"][0]
                    ok, tag_filtered_ids = test_memo_ids_with_tag(token, tag)
                    all_passed = all_passed and ok
                    if ok:
                        rich_print(
                            f"[bold green]成功获取标签'{tag}'的备忘录ID列表![/bold green]"
                        )
                        # 验证过滤结果是否包含我们的备忘录
                        if str(created_memo) in [str(id) for id in tag_filtered_ids]:
                            rich_print(
                                f"[bold green]标签过滤结果正确包含了备忘录 {created_memo}![/bold green]"
                            )
                        else:
                            rich_print(
                                f"[bold red]标签过滤结果未包含备忘录 {created_memo}![/bold red]"
                            )
                            all_passed = False

            # 添加新的测试：测试带多级标签参数的备忘录ID列表
            if ok and created_nested_memo is not None:
                # 获取刚创建的带多级标签的备忘录，提取其标签
                ok, nested_memo = test_get_memo(token, created_nested_memo)
                if (
                    ok
                    and nested_memo
                    and "tags" in nested_memo
                    and len(nested_memo["tags"]) > 0
                ):
                    # 找到包含 / 的多级标签
                    nested_tags = [tag for tag in nested_memo["tags"] if "/" in tag]
                    if nested_tags:
                        nested_tag = nested_tags[0]
                        ok, nested_tag_filtered_ids = test_memo_ids_with_nested_tag(
                            token, nested_tag
                        )
                        all_passed = all_passed and ok
                        if ok:
                            rich_print(
                                f"[bold green]成功获取多级标签'{nested_tag}'的备忘录ID列表![/bold green]"
                            )
                            # 验证过滤结果是否包含我们的备忘录
                            if str(created_nested_memo) in [
                                str(id) for id in nested_tag_filtered_ids
                            ]:
                                rich_print(
                                    f"[bold green]多级标签过滤结果正确包含了备忘录 {created_nested_memo}![/bold green]"
                                )
                            else:
                                rich_print(
                                    f"[bold red]多级标签过滤结果未包含备忘录 {created_nested_memo}![/bold red]"
                                )
                                all_passed = False

                    # 测试多级标签的父级标签过滤
                    if nested_tags:
                        parent_tag = nested_tags[0].split("/")[0]
                        ok, parent_tag_filtered_ids = test_memo_ids_with_tag(
                            token, parent_tag
                        )
                        all_passed = all_passed and ok
                        if ok:
                            rich_print(
                                f"[bold green]成功获取父级标签'{parent_tag}'的备忘录ID列表![/bold green]"
                            )
                            # 验证过滤结果是否包含我们的备忘录
                            if str(created_nested_memo) in [
                                str(id) for id in parent_tag_filtered_ids
                            ]:
                                rich_print(
                                    f"[bold green]父级标签过滤结果正确包含了备忘录 {created_nested_memo}![/bold green]"
                                )
                            else:
                                rich_print(
                                    f"[bold red]父级标签过滤结果未包含备忘录 {created_nested_memo}![/bold red]"
                                )
                                all_passed = False

            if ok and created_memo is not None:
                memo_id = created_memo

                # 测试获取备忘录
                ok, memo = test_get_memo(token, memo_id)
                all_passed = all_passed and ok

                # 测试获取标签元信息
                ok, tag_meta = test_get_tag_meta(token)
                all_passed = all_passed and ok
                if ok:
                    rich_print("[bold green]成功获取标签元信息![/bold green]")

                # 测试更新标签（如果备忘录有标签）
                if ok and memo and "tags" in memo and len(memo["tags"]) > 0:
                    old_tag = memo["tags"][0]
                    new_tag = f"{old_tag}_updated"
                    ok, update_result = test_update_tag(token, old_tag, new_tag)
                    all_passed = all_passed and ok
                    if ok:
                        rich_print(
                            f"[bold green]成功将标签 '{old_tag}' 更新为 '{new_tag}'![/bold green]"
                        )

                        # 验证标签更新是否生效
                        ok, updated_memo = test_get_memo(token, memo_id)
                        if ok and updated_memo and "tags" in updated_memo:
                            if new_tag in updated_memo["tags"]:
                                rich_print(
                                    "[bold green]标签更新已在备忘录中生效![/bold green]"
                                )
                            else:
                                rich_print(
                                    "[bold red]标签更新未在备忘录中生效![/bold red]"
                                )
                                all_passed = False

            # 测试多级标签更新
            if ok and created_nested_memo is not None:
                nested_memo_id = created_nested_memo

                # 获取带有多级标签的备忘录
                ok, nested_memo = test_get_memo(token, nested_memo_id)
                all_passed = all_passed and ok

                # 测试更新多级标签
                if (
                    ok
                    and nested_memo
                    and "tags" in nested_memo
                    and len(nested_memo["tags"]) > 0
                ):
                    # 找到包含 / 的多级标签
                    nested_tags = [tag for tag in nested_memo["tags"] if "/" in tag]
                    if nested_tags:
                        old_nested_tag = nested_tags[0]
                        new_nested_tag = f"{old_nested_tag}_updated"
                        ok, update_result = test_update_nested_tag(
                            token, old_nested_tag, new_nested_tag
                        )
                        all_passed = all_passed and ok
                        if ok:
                            rich_print(
                                f"[bold green]成功将多级标签 '{old_nested_tag}' 更新为 '{new_nested_tag}'![/bold green]"
                            )

                            # 验证多级标签更新是否生效
                            ok, updated_nested_memo = test_get_memo(
                                token, nested_memo_id
                            )
                            if (
                                ok
                                and updated_nested_memo
                                and "tags" in updated_nested_memo
                            ):
                                if new_nested_tag in updated_nested_memo["tags"]:
                                    rich_print(
                                        "[bold green]多级标签更新已在备忘录中生效![/bold green]"
                                    )
                                else:
                                    rich_print(
                                        "[bold red]多级标签更新未在备忘录中生效![/bold red]"
                                    )
                                    all_passed = False

                # 测试更新备忘录
                ok, updated_memo_id = test_update_memo(token, memo_id)
                all_passed = all_passed and ok

                # 验证更新后的备忘录内容
                if ok:
                    ok, updated_memo = test_get_memo(token, memo_id)
                    if ok and updated_memo:
                        if "这是更新后的备忘录内容" == updated_memo.get("content"):
                            rich_print("[bold green]备忘录内容已成功更新![/bold green]")
                        else:
                            rich_print("[bold red]备忘录内容未成功更新![/bold red]")
                            all_passed = False

                # 测试删除备忘录
                ok, deleted_memo_id = test_delete_memo(token, memo_id)
                all_passed = all_passed and ok

                # 测试删除带有多级标签的备忘录
                if nested_memo_id:
                    ok, deleted_nested_memo_id = test_delete_memo(token, nested_memo_id)
                    all_passed = all_passed and ok

                # 验证备忘录已被删除
                ok, final_ids = test_memo_ids(token)
                if ok and final_ids:
                    all_deleted = True
                    for id_to_check in [str(memo_id), str(nested_memo_id)]:
                        if id_to_check in [str(id) for id in final_ids]:
                            rich_print(
                                f"[bold red]备忘录 {id_to_check} 未成功删除![/bold red]"
                            )
                            all_deleted = False
                            all_passed = False

                    if all_deleted:
                        rich_print("[bold green]所有备忘录已成功删除![/bold green]")

            # 测试删除用户账号
            # 注意：这个测试应该放在最后执行，因为它会删除用户账号
            ok, deleted_user = test_delete_me(token)
            all_passed = all_passed and ok
            if ok:
                rich_print("[bold green]用户账号删除成功![/bold green]")

                # 尝试再次获取用户信息，应该失败
                try:
                    response = requests.get(
                        f"{BASE_URL}/me", headers={"Authorization": f"Bearer {token}"}
                    )
                    if response.status_code == 404:
                        rich_print(
                            "[bold green]用户账号确认已删除，无法获取用户信息![/bold green]"
                        )
                    else:
                        rich_print(
                            "[bold red]用户账号可能未成功删除，仍能获取用户信息![/bold red]"
                        )
                        all_passed = False
                except Exception:
                    rich_print(
                        "[bold green]用户账号确认已删除，无法获取用户信息![/bold green]"
                    )

    rich_print("\n[bold]所有测试完成！[/bold]")
    if all_passed:
        rich_print("[bold green]所有接口测试均通过！[/bold green]")
    else:
        rich_print("[bold red]部分接口测试未通过，请检查上方输出。[/bold red]")


if __name__ == "__main__":
    main()
