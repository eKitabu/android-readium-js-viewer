package org.apache.cordova.plugin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.res.Resources;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ListView;

import java.io.File;
import java.io.FileFilter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class AdvFileChooser extends Activity {
  private File currentDir;
  private FileArrayAdapter adapter;
  private FileFilter fileFilter;
  private File fileSelected;
  private ArrayList<String> extensions;
  private boolean selectFolder = false;
  private Resources resources;
  private String packageName;

  private AdapterView.OnItemClickListener listener = new AdapterView.OnItemClickListener() {
    @Override
    public void onItemClick(AdapterView<?> l, View v, int position,
    long id) {
      final Option o = adapter.getItem(position);
      if (!o.isBack()) {
        doSelect(o);
      } else {
        currentDir = new File(o.getPath());
        fill(currentDir);
      }
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    this.packageName = getApplication().getPackageName();
    this.resources = getApplication().getResources();

    setContentView(getIdentifier("list_view", "layout"));

    Bundle extras = getIntent().getExtras();
    String startingFolder = "/sdcard/";

    if (extras != null) {
      if (extras.getStringArrayList("filterFileExtension") != null) {
        extensions = extras.getStringArrayList("filterFileExtension");
        fileFilter = new FileFilter() {
          @Override
          public boolean accept(File pathname) {
            return ((pathname.isDirectory()) || (pathname.getName().contains(".")?extensions.contains(pathname.getName().substring(pathname.getName().lastIndexOf("."))):false));
          }
        };
      }
      if (extras.getBoolean("selectFolder")) {
        selectFolder = true;
        fileFilter = new FileFilter() {
          @Override
          public boolean accept(File pathname) {
            return (pathname.isDirectory());
          }
        };
      }

      if (extras.getString("suggestedPath") != null) {
        startingFolder = extras.getString("suggestedPath");
      }
    }

    currentDir = new File(startingFolder);
    fill(currentDir);
  }

  public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
          if (currentDir.getParentFile() != null) {
            currentDir = currentDir.getParentFile();
            fill(currentDir);
          } else {
            finish();
          }
            return false;
        }
        return super.onKeyDown(keyCode, event);
  }

  private void fill(File f) {
    File[] dirs = null;
    if (fileFilter != null)
      dirs = f.listFiles(fileFilter);
    else
      dirs = f.listFiles();
    this.setTitle(getStringRes("currentDir") + ": " + f.getName());
    List<Option> dir = new ArrayList<Option>();
    List<Option> fls = new ArrayList<Option>();
    try {
      for (File ff : dirs) {
        if (ff.isDirectory() && !ff.isHidden()) {
          dir.add(
            new Option(
              ff.getName(),
              getString( getIdentifier("folder", "string")),
              ff.getAbsolutePath(), true, false, false));
        }
        else {
          if (!ff.isHidden())
            fls.add(new Option(ff.getName(), getStringRes("fileSize") + ": "
                + ff.length(), ff.getAbsolutePath(), false, false, false));
        }
      }
    } catch (Exception e) {

    }
    Collections.sort(dir);
    Collections.sort(fls);
    dir.addAll(fls);

    if (f.getParentFile() != null) {
      dir.add(0, new Option("..", getStringRes("parentDirectory"), f.getParent(), false, true, true));
    }

    ListView listView = (ListView) findViewById(getIdentifier("lvFiles", "id"));

    adapter = new FileArrayAdapter(listView.getContext(), getIdentifier("file_view", "layout"),
        dir);
    listView.setAdapter(adapter);
    listView.setOnItemClickListener(listener);
  }

  private int getIdentifier(final String name, final String type) {
    return this.resources.getIdentifier(name, type, this.packageName);
  }

  private String getStringRes(final String name) {
    return getString(getIdentifier(name, "string"));
  }

  private void doSelect(final Option o) {
    if (o.isFolder() || o.isParent()) {
      if (!selectFolder) {
        currentDir = new File(o.getPath());
        fill(currentDir);
      } else {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);

        builder.setMessage(getStringRes("optionSelection"))
                .setPositiveButton(getStringRes("openFolder"), new DialogInterface.OnClickListener() {
                  public void onClick(DialogInterface dialog, int id) {
                    currentDir = new File(o.getPath());
                    fill(currentDir);
                  }
                }).setNegativeButton(getStringRes("selectThis"), new DialogInterface.OnClickListener() {
                  public void onClick(DialogInterface dialog, int id) {
                    fileSelected = new File(o.getPath());
                    if (fileSelected.canWrite()) {
                      Intent intent = new Intent();
                      intent.putExtra("fileSelected", fileSelected.getAbsolutePath());
                      setResult(Activity.RESULT_OK, intent);
                      finish();
                    } else {
                      showCannotWriteDialog();
                    }
                  }
                });
        AlertDialog alert = builder.create();
        alert.show();
      }
    } else {
      //onFileClick(o);
      fileSelected = new File(o.getPath());
      Intent intent = new Intent();
      intent.putExtra("fileSelected", fileSelected.getAbsolutePath());
      setResult(Activity.RESULT_OK, intent);
      finish();
    }
  }

  private void showCannotWriteDialog() {
    AlertDialog.Builder builder = new AlertDialog.Builder(AdvFileChooser.this);
    builder.setTitle("We're sorry! You can't save to this directory.")
           .setMessage("Do you want to choose another directory?")
           .setCancelable(false)
           .setPositiveButton("OK", null);
    AlertDialog alert = builder.create();
    alert.show();
  }
}
