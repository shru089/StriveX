import os
def count_loc(path):
    total = 0
    files = 0
    for root, dirs, f in os.walk(path):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '.venv', '__pycache__', 'dist')]
        for file in f:
            if not file.endswith(('.sqlite', '.log', '.pdf', '.png', '.jpg', '.json', '.lock')):
                with open(os.path.join(root, file), 'r', encoding='utf-8', errors='ignore') as fp:
                    total += len(fp.readlines())
                files += 1
    print(f"Total lines: {total}, Files: {files}")
count_loc('.')
